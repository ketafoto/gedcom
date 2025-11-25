import pytest

@pytest.fixture
def log_test_step(request):
    """
    Fixture for logging test steps with automatic test name printing on first call.
    
    Usage:
        def test_example(log_test_step):
            log_test_step("First step")  # Prints test class/function name + step
            log_test_step("Second step")  # Prints only the step
    """
    test_name_printed = False
    
    def _log_step(message: str):
        nonlocal test_name_printed
        
        # Print test name on first call only
        if not test_name_printed:
            # Get test class and function names
            test_class = request.cls.__name__ if request.cls else None
            test_function = request.function.__name__
            
            if test_class:
                test_header = f"\n{'='*70}\n{test_class}::{test_function}\n{'='*70}"
            else:
                test_header = f"\n{'='*70}\n{test_function}\n{'='*70}"
            
            print(test_header)
            test_name_printed = True
        
        # Print the step message
        print(f"  {message}")
    
    return _log_step

