#!/usr/bin/env python3
import sys
import pickle
import json

def predict_intent(message, model_path):
    try:
        # Load the trained model
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        
        # Predict intent
        probabilities = model.predict_proba([message.lower()])[0]
        predicted_class = model.predict([message.lower()])[0]
        confidence = max(probabilities)
        
        # Map to internal intent system
        intent_mapping = {
            'buy_car': 'purchase',
            'car_type_preference': 'car_type', 
            'budget_inquiry': 'budget',
            'financing_options': 'financing',
            'feature_request': 'features',
            'car_comparison': 'comparison',
            'check_availability': 'availability',
            'ask_discounts': 'discounts',
            'after_sales': 'after_sales',
            'purchase_commitment': 'purchase_commitment'
        }
        
        mapped_intent = intent_mapping.get(predicted_class, predicted_class)
        
        # Return result as JSON
        result = {
            'intent': mapped_intent,
            'confidence': float(confidence),
            'method': 'ml',
            'provider': 'enhanced_ml',
            'raw_intent': predicted_class,
            'probabilities': dict(zip(model.classes_, [float(p) for p in probabilities]))
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            'intent': 'unknown',
            'confidence': 0.0,
            'method': 'ml_error',
            'error': str(e)
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({'error': 'Usage: python ml-predict.py "message" model_path'}))
        sys.exit(1)
    
    message = sys.argv[1]
    model_path = sys.argv[2]
    predict_intent(message, model_path)
