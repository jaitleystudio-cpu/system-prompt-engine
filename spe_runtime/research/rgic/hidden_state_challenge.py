from typing import List, Dict, Any

class HiddenStateEnvironment:
    def __init__(self, env_type: str):
        """
        env_type can be 'A' (discoverable), 'B' (unidentifiable), 'C' (mechanism changed)
        """
        self.env_type = env_type
        self.toggles = 0
        self.history: List[Dict[str, Any]] = []
        self.mechanism_changed = False

    def toggle(self, timestamp: int):
        self.toggles += 1
        self.history.append({"action": "TOGGLE", "time": timestamp})

    def apply(self, x: Any, timestamp: int) -> Any:
        self.history.append({"action": "APPLY", "x": x, "time": timestamp})
        
        if self.env_type == 'A':
            # Parity of toggles
            state = self.toggles % 2
            return f"output_for_{x}_state_{state}"
        elif self.env_type == 'B':
            # Unidentifiable: state changes randomly, not predictable from history
            # To make tests deterministic we could just mock it, but random is fine.
            import random
            state = random.randint(0, 1)
            return f"output_for_{x}_state_{state}"
        elif self.env_type == 'C':
            if self.mechanism_changed:
                # Different logic after drift
                state = (self.toggles // 2) % 2
            else:
                state = self.toggles % 2
            return f"output_for_{x}_state_{state}"
            
    def trigger_mechanism_change(self):
        if self.env_type == 'C':
            self.mechanism_changed = True

def parity_measurement(history: List[Dict[str, Any]]) -> int:
    toggles = sum(1 for e in history if e.get("action") == "TOGGLE")
    return toggles % 2
