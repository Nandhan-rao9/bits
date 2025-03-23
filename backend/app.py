from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import re
from datetime import datetime
from openai import OpenAI
import base64
from pymongo import MongoClient
import json
from predict_models import predict_with_saved_models, generate_recommendations_from_saved_models, get_default_food_sources, display_recommendations
import pandas as pd
import traceback
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Configuration constants
FLASK_ENV = 'development'
FLASK_APP = 'app.py'

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:5173", "methods": ["GET", "POST", "OPTIONS"], "allow_headers": ["Content-Type", "Authorization"]}})

# Initialize OpenAI client
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# USDA API configuration
USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'

# MongoDB connection
client = MongoClient(MONGO_URI)
db = client['nutrition_db']
food_collection = db['food_data']
total_nutrients_collection = db['total_nutrients']

@app.route('/predict', methods=['POST'])
def predict_nutrition_risk():
    """Endpoint for nutrition risk assessment using saved models"""
    try:
        data = request.get_json()
        nutrition_data = pd.DataFrame(data['nutrition_data'])
        models_dir = "saved_models"
        predictions = predict_with_saved_models(nutrition_data, models_dir)
        
        if predictions is None:
            return jsonify({'error': 'Failed to generate predictions. Models may not be available.'}), 500
        
        predictions_json = predictions.to_dict(orient='records')
        recommendations = generate_recommendations_from_saved_models(nutrition_data, models_dir)
        
        formatted_recommendations = {}
        if recommendations:
            for nutrient, data in recommendations.items():
                formatted_recommendations[nutrient] = {
                    'current': float(data['current']),
                    'target': float(data['target']),
                    'diseases': data['diseases'],
                    'importance': float(data['importance'])
                }
        
        food_sources = get_default_food_sources()
        
        return jsonify({
            'predictions': predictions_json,
            'recommendations': formatted_recommendations,
            'food_sources': food_sources
        }), 200
        
    except Exception as e:
        logger.error(f"Error in predict_nutrition_risk: {str(e)}")
        return jsonify({'error': str(e)}), 500

user_nutritional_data = {'food_items': []}

class ImageAnalyzer:
    def __init__(self, api_key):
        self.client = OpenAI(api_key=api_key)

    def encode_image(self, image_file):
        """Encode image from file upload to base64 string."""
        image_data = image_file.read()
        return base64.b64encode(image_data).decode('utf-8')

    def analyze_image_ML(self, image_file, prompt="What food items are in this image? Please list them separately."):
        """Analyze an image using OpenAI's Vision API."""
        try:
            base64_image = self.encode_image(image_file)
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=300
            )
            return response.choices[0].message.content
        except Exception as e:
            raise Exception(f"Error analyzing image: {str(e)}")

def get_food_info_from_usda(food_name):
    """Fetch food information from USDA API"""
    try:
        search_url = f"{USDA_BASE_URL}/foods/search"
        params = {
            'api_key': USDA_API_KEY,
            'query': food_name,
            'dataType': ["Survey (FNDDS)"],
            'pageSize': 1
        }
        response = requests.get(search_url, params=params)
        response.raise_for_status()
        
        data = response.json()
        if data['foods']:
            food = data['foods'][0]
            nutrients = food.get('foodNutrients', [])
            
            nutrition_info = {
                'calories': next((n['value'] for n in nutrients if n['nutrientName'] == 'Energy'), 0),
                'protein': next((n['value'] for n in nutrients if n['nutrientName'] == 'Protein'), 0),
                'carbs': next((n['value'] for n in nutrients if n['nutrientName'] == 'Carbohydrate, by difference'), 0),
                'fat': next((n['value'] for n in nutrients if n['nutrientName'] == 'Total lipid (fat)'), 0),
                'fiber': next((n['value'] for n in nutrients if n['nutrientName'] == 'Fiber, total dietary'), 0),
                'vitamins': {
                    'a': next((n['value'] for n in nutrients if 'Vitamin A' in n['nutrientName']), 0),
                    'c': next((n['value'] for n in nutrients if 'Vitamin C' in n['nutrientName']), 0),
                    'd': next((n['value'] for n in nutrients if 'Vitamin D' in n['nutrientName']), 0),
                    'e': next((n['value'] for n in nutrients if 'Vitamin E' in n['nutrientName']), 0)
                },
                'minerals': {
                    'iron': next((n['value'] for n in nutrients if 'Iron' in n['nutrientName']), 0),
                    'calcium': next((n['value'] for n in nutrients if 'Calcium' in n['nutrientName']), 0),
                    'potassium': next((n['value'] for n in nutrients if 'Potassium' in n['nutrientName']), 0)
                }
            }
            return nutrition_info
        return None
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching USDA data: {e}")
        return None

@app.route('/analyze-ingredients', methods=['POST'])
def analyze_ingredients():
    """Endpoint for ingredient list analysis"""
    if 'image' not in request.files:
        logger.warning("No image provided in request")
        return jsonify({'error': 'No image provided'}), 400
    
    try:
        image_file = request.files['image']
        logger.info(f"Received image: {image_file.filename}")
        
        bytes_data = image_file.read()
        logger.info(f"Read {len(bytes_data)} bytes of image data")
        if not bytes_data or len(bytes_data) == 0:
            logger.error("Empty image file received")
            return jsonify({'error': 'Empty image file received'}), 400

        class IngredientAnalyzer:
            def __init__(self, api_key):
                self.client = OpenAI(api_key=api_key)

            def encode_image(self, image_bytes):
                try:
                    return base64.b64encode(image_bytes).decode('utf-8')
                except Exception as e:
                    logger.error(f"Image encoding error: {str(e)}")
                    raise

            def analyze_image(self, image_bytes):
                prompt = """
                You are a food safety expert. Analyze the ingredient list in this image and return a response in **valid JSON format only**. Do not include markdown, explanations, or any text outside the JSON structure. If no ingredients are detected or the image is unclear, return an empty JSON object `{}`. Use this exact structure:
                {
                    "harmful_ingredients": [
                        {
                            "name": "ingredient name",
                            "effects": "specific health effects and concerns",
                            "banned_countries": ["country1", "country2"],
                            "usage_restrictions": "specific usage restrictions in food items globally"
                        }
                    ],
                    "artificial_additives": {
                        "emulsifiers": [
                            {
                                "code": "E-number or other code",
                                "name": "emulsifier name",
                                "effects": "health effects and concerns",
                                "banned_countries": ["country1", "country2"],
                                "usage_restrictions": "specific usage restrictions in food items globally"
                            }
                        ],
                        "glazing_agents": [],
                        "colors": [],
                        "other": []
                    },
                    "preservatives": [],
                    "artificial_flavors": [],
                    "overall_assessment": {
                        "risk_level": "low/moderate/high",
                        "summary": "detailed summary of overall product safety and concerns",
                        "recommendations": ["specific recommendations for consumers"]
                    }
                }
                """
                try:
                    base64_image = self.encode_image(image_bytes)
                    logger.info("Image encoded successfully, sending to OpenAI API")
                    
                    response = self.client.chat.completions.create(
                        model="gpt-4o",
                        messages=[
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": prompt},
                                    {
                                        "type": "image_url",
                                        "image_url": {
                                            "url": f"data:image/jpeg;base64,{base64_image}",
                                            "detail": "high"
                                        }
                                    }
                                ]
                            }
                        ],
                        max_tokens=1500,
                        temperature=0.5
                    )
                    raw_response = response.choices[0].message.content
                    logger.info(f"Raw OpenAI response: {raw_response[:100]}...")
                    return raw_response
                except Exception as e:
                    logger.error(f"OpenAI API error: {str(e)}")
                    raise Exception(f"Error analyzing image with OpenAI: {str(e)}")

        def clean_json_response(response_text):
            """Clean the API response to ensure valid JSON."""
            logger.debug(f"Original response: {response_text[:100]}...")
            # Remove markdown or unexpected formatting
            response_text = re.sub(r'```(?:json)?', '', response_text)
            response_text = re.sub(r'```', '', response_text).strip()
            # If it’s not JSON, return an empty object as fallback
            if not response_text.startswith('{') or not response_text.endswith('}'):
                logger.warning("Response is not valid JSON, returning empty object")
                return '{}'
            return response_text
        
        logger.info("Creating analyzer")
        analyzer = IngredientAnalyzer(OPENAI_API_KEY)
        logger.info("Analyzing image")
        analysis_result = analyzer.analyze_image(bytes_data)
        
        if not analysis_result:
            logger.error("No analysis result returned")
            return jsonify({'error': 'Failed to analyze image - no result received'}), 500
        
        logger.info("Cleaning JSON response")
        cleaned_response = clean_json_response(analysis_result)
        try:
            result = json.loads(cleaned_response)
            logger.info("JSON parsed successfully")
            return jsonify(result)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error after cleaning: {str(e)}")
            return jsonify({'error': 'Failed to parse analysis result', 'raw_response': analysis_result}), 500
    
    except Exception as e:
        logger.error(f"Unexpected error in analyze_ingredients: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f"Server error: {str(e)}", 'stack_trace': traceback.format_exc()}), 500

class MentalHealthChatbot:
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
        self.system_prompt = """
        You are a compassionate and professional health expert. Your role is to:
        1. Listen to the user's concerns with empathy and understanding.
        2. Offer emotional validation and reassurance.
        3. Provide coping strategies and self-care techniques.
        4. Recognize signs of mental health distress or crisis, and gently guide the user toward professional help when necessary.

        Important guidelines:
        - Always maintain a supportive and non-judgmental tone.
        - Do not provide medical diagnoses or offer harmful advice.
        - Offer emotional validation and encourage self-care without judgment.
        - If the user mentions suicidal thoughts or severe distress, provide resources for professional help and contact emergency services if necessary.
        - Respect the user's privacy and confidentiality.
        - Ensure responses are emotionally sensitive and encouraging.
        """

    def generate_response(self, user_message: str) -> str:
        try:
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=200
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error: {str(e)}"

    def handle_crisis_indicators(self, message: str) -> bool:
        crisis_keywords = ["suicide", "harm", "death", "self-harm", "hopeless", "worthless", "ending it", "I want to die"]
        return any(keyword in message.lower() for keyword in crisis_keywords)

    def get_crisis_resources(self) -> str:
        return """
        I'm really sorry that you're feeling this way. Your safety and well-being are so important, and I strongly encourage you to talk to someone who can provide more specialized support.
        Please reach out to a counselor, therapist, or someone you trust. If you're in immediate danger, please contact emergency services.
        Here are some resources you can reach out to:
        - National Suicide Prevention Lifeline: 1-800-273-8255 (USA)
        - Text HOME to 741741 to connect with a Crisis Text Line counselor (USA)
        - If you're outside of the USA, please reach out to a local crisis helpline.
        You are not alone, and there is support available for you.
        """

    def chat(self, user_message: str) -> str:
        if self.handle_crisis_indicators(user_message):
            return self.get_crisis_resources()
        
        response = self.generate_response(user_message)
        
        if "sad" in user_message.lower():
            response = """
            I'm really sorry you're feeling sad. It's completely okay to feel this way sometimes—emotions are a natural part of being human. 
            It might help to talk about what's on your mind, or even engage in something that brings you comfort. 
            Sometimes, simple acts like taking a walk, doing something creative, or even reaching out to a friend can help you feel a bit better.
            Remember, you're not alone in this, and it's okay to ask for support when you need it.
            """
        
        elif "stressed" in user_message.lower():
            response = """
            Stress can feel overwhelming, but it's also something that can be managed with the right tools. 
            Take a deep breath and try to focus on one thing at a time. Sometimes it can help to break things down into smaller tasks or take short breaks.
            Be kind to yourself, and remember that it's okay to ask for help or talk about what's stressing you out.
            You're doing the best you can, and that's enough.
            """
        
        elif "overwhelmed" in user_message.lower():
            response = """
            It sounds like you're feeling overwhelmed, which is completely understandable. It's important to recognize when things feel like too much. 
            Try to take a step back and give yourself some space to breathe. Small moments of self-care, like resting or doing something you enjoy, can make a difference.
            You're strong for recognizing how you feel, and you're capable of finding ways to navigate through this.
            """
        
        return response

@app.route('/analyze-image', methods=['POST'])
def analyze_image():
    """Endpoint for image analysis"""
    if 'image' not in request.files:
        logger.warning("No image provided in analyze-image request")
        return jsonify({'error': 'No image provided'}), 400
    
    try:
        analyzer = ImageAnalyzer(OPENAI_API_KEY)
        image_file = request.files['image']
        food_items = analyzer.analyze_image_ML(image_file)
        foods = [item.strip() for item in food_items.split('\n') if item.strip()]

        harmful_ingredients = ["sugar", "sodium", "trans fat", "artificial sweeteners", "MSG", "high fructose corn syrup"]

        results = []
        for food in foods:
            nutrition_info = get_food_info_from_usda(food)
            if nutrition_info:
                warnings = []
                for harmful in harmful_ingredients:
                    if harmful.lower() in food.lower():
                        warnings.append(f"Contains {harmful}, which may be harmful to health.")

                food_data = {
                    'name': food,
                    'confidence': 0.95,
                    'nutrition': nutrition_info,
                    'warnings': warnings
                }
                results.append(food_data)
                user_nutritional_data['food_items'].append(food_data)

        return jsonify(results)
    except Exception as e:
        logger.error(f"Error in analyze_image: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/commit', methods=['POST'])
def commit_nutrition_data():
    """Endpoint for committing food details to MongoDB."""
    try:
        data = request.get_json()
        food_data = data.get('foodData', [])
        total_nutrients = data.get('totalNutrients', {})

        if food_data:
            food_collection.insert_many(food_data)

        if total_nutrients:
            total_nutrients_doc = {
                "total_nutrients": total_nutrients,
                "timestamp": datetime.now()
            }
            total_nutrients_collection.insert_one(total_nutrients_doc)

        return jsonify({'message': 'Nutrition data successfully committed to MongoDB!'}), 200
    except Exception as e:
        logger.error(f"Error in commit_nutrition_data: {str(e)}")
        return jsonify({'error': 'Failed to commit nutrition data. Please try again.'}), 500

@app.route('/getnutrition', methods=['GET'])
def get_nutrition_data():
    """Endpoint to get nutrition data from MongoDB"""
    try:
        total_nutrients = total_nutrients_collection.find().sort('timestamp', -1).limit(1)
        if total_nutrients:
            return jsonify([doc['total_nutrients'] for doc in total_nutrients]), 200
        else:
            return jsonify({'message': 'No nutrition data available'}), 404
    except Exception as e:
        logger.error(f"Error in get_nutrition_data: {str(e)}")
        return jsonify({'error': 'Failed to fetch nutrition data. Please try again.'}), 500

@app.route('/chat', methods=['POST'])
def chat():
    """Endpoint for mental health chatbot interaction"""
    user_message = request.json.get("message", "")
    chatbot = MentalHealthChatbot(api_key=OPENAI_API_KEY)
    response = chatbot.chat(user_message)
    return jsonify({'response': response})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)