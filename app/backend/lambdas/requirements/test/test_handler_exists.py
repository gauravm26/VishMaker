#!/usr/bin/env python3
"""
Test script to verify the handler function exists and can be imported
"""

import sys
import os

# Add the parent directory to the path so we can import the main module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_handler_exists():
    """Test that the handler function exists and can be imported"""
    
    try:
        # Try to import the main module
        print("🔍 Testing import of main module...")
        import main
        print("✅ Successfully imported main module")
        
        # Check if handler function exists
        if hasattr(main, 'handler'):
            print("✅ Handler function exists in main module")
            print(f"Handler function: {main.handler}")
            print(f"Handler function type: {type(main.handler)}")
        else:
            print("❌ Handler function does not exist in main module")
            print("Available functions in main module:")
            for attr in dir(main):
                if not attr.startswith('_'):
                    print(f"  - {attr}")
        
        # Check if app exists (for FastAPI)
        if hasattr(main, 'app'):
            print("✅ FastAPI app exists in main module")
        else:
            print("❌ FastAPI app does not exist in main module")
            
        return True
        
    except ImportError as e:
        print(f"❌ Failed to import main module: {e}")
        return False
    except Exception as e:
        print(f"❌ Error testing handler: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_handler_exists() 