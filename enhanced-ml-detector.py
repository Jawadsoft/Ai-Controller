#!/usr/bin/env python3
"""
🚀 Enhanced ML Intent Detector for CrewAI
Uses scikit-learn with improved confidence thresholds
Compatible with Python 3.12+
"""

import json
import pickle
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import re
from typing import Dict, List, Tuple, Optional
import time

class EnhancedMLIntentDetector:
    def __init__(self, model_path: str = None):
        """Initialize the Enhanced ML Intent Detector"""
        self.model = None
        self.vectorizer = None
        self.intent_mapping = {
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
        
        # Load pre-trained model if available
        if model_path:
            self.load_model(model_path)
    
    def create_enhanced_training_data(self) -> Tuple[List[str], List[str]]:
        """Create comprehensive training data with more examples and variations"""
        
        training_data = {
            'buy_car': [
                # Basic variations
                "I want to buy a car",
                "Can you help me find a vehicle?",
                "I'm looking to get a new ride",
                "I want to purchase an automobile",
                "Help me find a car",
                "I'm in the market for a vehicle",
                "I need to buy a new car",
                "I want to own a car",
                "I'm looking for a vehicle",
                "Can you sell me a car?",
                "I'm interested in buying",
                "I want to get a new car",
                "Help me purchase a vehicle",
                "I'm ready to buy a car",
                "I need a new automobile",
                # Additional variations
                "Looking to buy",
                "Want to purchase",
                "Need a new vehicle",
                "In the market",
                "Interested in purchasing",
                "Ready to buy",
                "Want to own",
                "Looking for a car",
                "Need to buy",
                "Want to get a car",
                "Help me buy",
                "Show me cars to buy",
                "I'm buying",
                "Car purchase",
                "Vehicle buying",
                "Auto purchase"
            ],
            
            'car_type_preference': [
                # Basic variations
                "I want an SUV",
                "Show me electric cars",
                "Do you have sedans?",
                "I prefer crossover vehicles",
                "Show me hybrid cars",
                "I want a luxury vehicle",
                "Do you have trucks?",
                "I'm interested in electric vehicles",
                "Show me sport utility vehicles",
                "I want a family car",
                "I need a compact car",
                "Show me minivans",
                "I want a sports car",
                "Do you have hatchbacks?",
                "I prefer 4x4 vehicles",
                # Additional variations
                "SUV preference",
                "Electric vehicle",
                "Sedan options",
                "Crossover SUV",
                "Hybrid cars",
                "Luxury vehicles",
                "Truck options",
                "EV cars",
                "Sport utility",
                "Family vehicle",
                "Compact car",
                "Minivan options",
                "Sports car",
                "Hatchback cars",
                "4x4 vehicles",
                "SUV models",
                "Electric cars",
                "Sedan models",
                "Crossover options",
                "Hybrid models",
                "Luxury models",
                "Truck models"
            ],
            
            'budget_inquiry': [
                # Basic variations
                "My budget is $30,000",
                "Show me cars under $25k",
                "What's the cheapest SUV?",
                "I can spend up to $40,000",
                "What's available in my price range?",
                "I have a budget of $35,000",
                "Show me affordable cars",
                "What cars are in my budget?",
                "I want something economical",
                "What's the price range for SUVs?",
                "I'm looking for cars under $30k",
                "What can I get for $25,000?",
                "Show me budget-friendly options",
                "I need something under $40k",
                "What's the best value for my money?",
                # Additional variations
                "Budget under",
                "Price range",
                "Affordable options",
                "Cheap cars",
                "Economical vehicles",
                "Budget friendly",
                "Price limit",
                "Cost range",
                "Affordable price",
                "Budget cars",
                "Under budget",
                "Price budget",
                "Cost budget",
                "Affordable budget",
                "Budget options",
                "Price under",
                "Cost under",
                "Budget limit",
                "Price limit",
                "Cost limit"
            ],
            
            'financing_options': [
                # Basic variations
                "Do you have loan options?",
                "Can I pay monthly?",
                "Do you offer leasing?",
                "What financing do you have?",
                "I need a payment plan",
                "Do you offer credit?",
                "What are the loan terms?",
                "Can I finance this car?",
                "Do you have zero percent financing?",
                "What's the interest rate?",
                "I want to lease a car",
                "What payment options do you have?",
                "Can I get a loan here?",
                "What's the down payment?",
                "Do you offer trade-in financing?",
                # Additional variations
                "Loan options",
                "Monthly payments",
                "Leasing options",
                "Financing terms",
                "Payment plans",
                "Credit options",
                "Loan terms",
                "Car financing",
                "Zero percent",
                "Interest rate",
                "Lease options",
                "Payment options",
                "Auto loan",
                "Down payment",
                "Trade in financing",
                "Financing options",
                "Payment terms",
                "Loan rates",
                "Credit terms",
                "Financing rates",
                "Payment financing",
                "Auto financing"
            ],
            
            'feature_request': [
                # Basic variations
                "I need a 7-seater",
                "Which cars have advanced safety features?",
                "I want black color",
                "Show me cars with leather seats",
                "I need all-wheel drive",
                "Which cars have backup cameras?",
                "I want heated seats",
                "Show me cars with navigation",
                "I need cargo space",
                "Which cars have sunroofs?",
                "I want a car with good fuel economy",
                "Show me vehicles with lane departure warning",
                "I need a car with good crash ratings",
                "Which cars have Apple CarPlay?",
                "I want a car with good resale value",
                # Additional variations
                "7 seater",
                "Safety features",
                "Black color",
                "Leather seats",
                "All wheel drive",
                "Backup camera",
                "Heated seats",
                "Navigation system",
                "Cargo space",
                "Sunroof",
                "Fuel economy",
                "Lane departure",
                "Crash ratings",
                "Apple CarPlay",
                "Resale value",
                "Car features",
                "Vehicle features",
                "Safety systems",
                "Color options",
                "Seat options",
                "Drive options",
                "Camera systems",
                "Entertainment",
                "Storage space",
                "Roof options"
            ],
            
            'car_comparison': [
                # Basic variations
                "Which is better: Corolla or Civic?",
                "Compare RAV4 and CR-V",
                "What's the difference?",
                "Which car is more reliable?",
                "Compare fuel economy",
                "Which has better safety ratings?",
                "What are the pros and cons?",
                "Which car should I choose?",
                "Compare these vehicles",
                "What's the difference between them?",
                "Which SUV is better?",
                "Compare the features",
                "What are the differences?",
                "Which one should I get?",
                "Help me choose between these",
                # Additional variations
                "Compare cars",
                "Which better",
                "Car comparison",
                "Vehicle comparison",
                "Pros and cons",
                "Choose between",
                "Better option",
                "Compare features",
                "Differences between",
                "Which to choose",
                "Compare models",
                "Better choice",
                "Compare options",
                "Which one",
                "Compare vehicles",
                "Better vehicle",
                "Compare options",
                "Which option",
                "Compare choices",
                "Better choice",
                "Compare models"
            ],
            
            'check_availability': [
                # Basic variations
                "Is the Toyota RAV4 in stock?",
                "Do you have same-day delivery?",
                "Can I test drive today?",
                "What's currently available?",
                "Do you have this car in stock?",
                "When can I test drive?",
                "What's in your inventory?",
                "Can I see this car in person?",
                "Is this available now?",
                "What's the delivery timeline?",
                "Do you have this model?",
                "Can I schedule a test drive?",
                "What's your current stock?",
                "Is this vehicle available?",
                "When can I pick it up?",
                # Additional variations
                "In stock",
                "Available now",
                "Current inventory",
                "Test drive",
                "Delivery options",
                "Stock availability",
                "Vehicle availability",
                "Model availability",
                "Schedule test drive",
                "Current stock",
                "Available vehicles",
                "Stock status",
                "Availability check",
                "Inventory check",
                "Stock check",
                "Available models",
                "Current availability",
                "Stock options",
                "Available options",
                "Inventory status",
                "Stock status"
            ],
            
            'ask_discounts': [
                # Basic variations
                "Are there any promotions?",
                "Do you offer trade-in deals?",
                "What discounts do you have?",
                "Any special offers?",
                "Do you have sales?",
                "What deals are available?",
                "Any cashback offers?",
                "Do you have manufacturer rebates?",
                "What incentives do you offer?",
                "Any promotional financing?",
                "Are there any special prices?",
                "Do you offer student discounts?",
                "What promotions are running?",
                "Any end-of-year deals?",
                "Do you have clearance sales?",
                # Additional variations
                "Promotions",
                "Trade in deals",
                "Discounts",
                "Special offers",
                "Sales",
                "Deals available",
                "Cashback",
                "Manufacturer rebates",
                "Incentives",
                "Promotional financing",
                "Special prices",
                "Student discounts",
                "Running promotions",
                "End of year",
                "Clearance sales",
                "Promotional deals",
                "Discount offers",
                "Special deals",
                "Promotional offers",
                "Discount deals",
                "Special sales",
                "Promotional sales",
                "Discount sales"
            ],
            
            'after_sales': [
                # Basic variations
                "What's the warranty on this car?",
                "Do you include free servicing?",
                "What's the insurance cost?",
                "What maintenance is included?",
                "Do you offer roadside assistance?",
                "What's the service package?",
                "Do you have extended warranty?",
                "What's included in maintenance?",
                "Do you offer service contracts?",
                "What's the service schedule?",
                "What's covered under warranty?",
                "Do you provide maintenance?",
                "What service options do you have?",
                "Is roadside assistance included?",
                "What's the maintenance cost?",
                # Additional variations
                "Warranty",
                "Free servicing",
                "Insurance cost",
                "Maintenance included",
                "Roadside assistance",
                "Service package",
                "Extended warranty",
                "Maintenance options",
                "Service contracts",
                "Service schedule",
                "Warranty coverage",
                "Maintenance service",
                "Service options",
                "Roadside help",
                "Maintenance cost",
                "Car warranty",
                "Vehicle warranty",
                "Service warranty",
                "Maintenance warranty",
                "Warranty service",
                "Service maintenance",
                "Warranty options",
                "Service options"
            ],
            
            'purchase_commitment': [
                # Basic variations
                "I want this car, what's next?",
                "Can I proceed with buying now?",
                "How do I book this vehicle?",
                "I'm ready to purchase",
                "What's the next step?",
                "How do I complete the order?",
                "I want to finalize this deal",
                "How do I secure this vehicle?",
                "What do I need to do to buy?",
                "I'm ready to take it home",
                "Let's complete the purchase",
                "I want to buy this now",
                "How do I finalize the deal?",
                "What's needed to complete?",
                "I'm ready to sign the papers",
                # Additional variations
                "Ready to buy",
                "Proceed with purchase",
                "Book vehicle",
                "Complete order",
                "Finalize deal",
                "Secure vehicle",
                "Complete purchase",
                "Buy now",
                "Finalize purchase",
                "Complete deal",
                "Sign papers",
                "Purchase completion",
                "Buy completion",
                "Deal completion",
                "Purchase finalization",
                "Buy finalization",
                "Deal finalization",
                "Complete buying",
                "Finalize buying",
                "Complete deal",
                "Finalize deal",
                "Purchase ready",
                "Buy ready"
            ]
        }
        
        # Create training data
        texts = []
        labels = []
        
        for intent, examples in training_data.items():
            for example in examples:
                texts.append(example.lower())
                labels.append(intent)
        
        return texts, labels
    
    def train_model(self, save_path: str = "enhanced_intent_model.pkl"):
        """Train the enhanced ML model with more training data"""
        print("🧠 Training Enhanced ML Intent Detection Model...")
        
        # Get enhanced training data
        texts, labels = self.create_enhanced_training_data()
        
        # Split into training and testing sets
        X_train, X_test, y_train, y_test = train_test_split(
            texts, labels, test_size=0.2, random_state=42, stratify=labels
        )
        
        # Create and train the model with better parameters
        self.model = Pipeline([
            ('tfidf', TfidfVectorizer(
                max_features=10000,
                ngram_range=(1, 3),
                stop_words='english',
                lowercase=True,
                min_df=1,
                max_df=0.9
            )),
            ('classifier', MultinomialNB(alpha=0.1))
        ])
        
        # Train the model
        start_time = time.time()
        self.model.fit(X_train, y_train)
        training_time = time.time() - start_time
        
        # Evaluate the model
        y_pred = self.model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        print(f"✅ Enhanced model trained successfully!")
        print(f"📊 Training accuracy: {accuracy:.2%}")
        print(f"⏱️ Training time: {training_time:.2f} seconds")
        print(f"📝 Training samples: {len(X_train)}")
        print(f"🧪 Test samples: {len(X_test)}")
        
        # Detailed classification report
        print("\n📈 Classification Report:")
        print(classification_report(y_test, y_pred, target_names=list(set(labels))))
        
        # Save the model
        self.save_model(save_path)
        
        return accuracy
    
    def predict_intent(self, message: str, confidence_threshold: float = 0.15) -> Dict:
        """Predict intent with improved confidence threshold"""
        if self.model is None:
            return {
                'intent': 'unknown',
                'confidence': 0.0,
                'method': 'ml_failed',
                'error': 'Model not trained'
            }
        
        try:
            # Preprocess message
            processed_message = message.lower().strip()
            
            # Get prediction probabilities
            probabilities = self.model.predict_proba([processed_message])[0]
            predicted_class = self.model.predict([processed_message])[0]
            confidence = max(probabilities)
            
            # Map to internal intent system
            mapped_intent = self.intent_mapping.get(predicted_class, predicted_class)
            
            # Check confidence threshold (lowered for better coverage)
            if confidence >= confidence_threshold:
                return {
                    'intent': mapped_intent,
                    'confidence': confidence,
                    'method': 'ml',
                    'provider': 'enhanced_ml',
                    'raw_intent': predicted_class,
                    'probabilities': dict(zip(self.model.classes_, probabilities))
                }
            else:
                return {
                    'intent': 'unknown',
                    'confidence': confidence,
                    'method': 'ml_low_confidence',
                    'provider': 'enhanced_ml',
                    'raw_intent': predicted_class,
                    'probabilities': dict(zip(self.model.classes_, probabilities))
                }
                
        except Exception as e:
            return {
                'intent': 'unknown',
                'confidence': 0.0,
                'method': 'ml_error',
                'error': str(e)
            }
    
    def save_model(self, filepath: str):
        """Save the trained model to disk"""
        try:
            with open(filepath, 'wb') as f:
                pickle.dump(self.model, f)
            print(f"✅ Enhanced model saved to: {filepath}")
        except Exception as e:
            print(f"❌ Error saving model: {e}")
    
    def load_model(self, filepath: str):
        """Load a trained model from disk"""
        try:
            with open(filepath, 'rb') as f:
                self.model = pickle.load(f)
            print(f"✅ Enhanced model loaded from: {filepath}")
        except Exception as e:
            print(f"❌ Error loading model: {e}")
    
    def test_model(self, test_messages: List[str]):
        """Test the enhanced model with sample messages"""
        print("\n🧪 Testing Enhanced Model with Sample Messages:")
        print("=" * 70)
        
        for i, message in enumerate(test_messages, 1):
            result = self.predict_intent(message)
            print(f"\n{i}. Message: '{message}'")
            print(f"   Intent: {result['intent']}")
            print(f"   Confidence: {result['confidence']:.2%}")
            print(f"   Method: {result['method']}")
            
            if 'probabilities' in result:
                top_3 = sorted(result['probabilities'].items(), 
                              key=lambda x: x[1], reverse=True)[:3]
                print(f"   Top 3 predictions:")
                for intent, prob in top_3:
                    print(f"     {intent}: {prob:.2%}")

def main():
    """Main function to train and test the enhanced model"""
    print("🚀 Enhanced ML Intent Detector for CrewAI")
    print("=" * 55)
    
    # Initialize enhanced detector
    detector = EnhancedMLIntentDetector()
    
    # Train the enhanced model
    accuracy = detector.train_model()
    
    # Test with sample messages
    test_messages = [
        "I want to buy a car",
        "What's available in my price range?",
        "Do you offer financing?",
        "I need a 7-seater SUV",
        "Which is better: RAV4 or CR-V?",
        "Is the Toyota RAV4 in stock?",
        "Are there any promotions?",
        "What's the warranty on this car?",
        "I'm ready to purchase now",
        "Show me electric vehicles"
    ]
    
    detector.test_model(test_messages)
    
    print(f"\n🎉 Enhanced model training complete!")
    print(f"📊 Accuracy: {accuracy:.2%}")
    print(f"💾 Model saved as: enhanced_intent_model.pkl")
    print(f"\n🚀 Ready to integrate with CrewAI!")
    print(f"💡 Confidence threshold: 15% (improved coverage)")

if __name__ == "__main__":
    main()
