from spe_runtime.research.rgic.hidden_state_challenge import HiddenStateEnvironment, parity_measurement

def test_environment_A_discoverable_state():
    env = HiddenStateEnvironment('A')
    
    # 0 toggles
    assert env.apply("input1", 1) == "output_for_input1_state_0"
    
    # 1 toggle
    env.toggle(2)
    assert env.apply("input1", 3) == "output_for_input1_state_1"
    
    # 2 toggles
    env.toggle(4)
    assert env.apply("input1", 5) == "output_for_input1_state_0"
    
    # measurement
    assert parity_measurement(env.history) == 0

def test_environment_B_unidentifiable_state():
    env = HiddenStateEnvironment('B')
    
    out1 = env.apply("input1", 1)
    env.toggle(2)
    out2 = env.apply("input1", 3)
    
    # We can't deterministically assert state logic for B since it's random,
    # but we can verify it returns properly formatted strings
    assert "output_for_input1_state_" in out1
    assert "output_for_input1_state_" in out2

def test_environment_C_mechanism_change():
    env = HiddenStateEnvironment('C')
    
    # Before drift, parity of toggles
    env.toggle(1)
    assert env.apply("x", 2) == "output_for_x_state_1"
    env.toggle(3)
    assert env.apply("x", 4) == "output_for_x_state_0"
    
    # Drift
    env.trigger_mechanism_change()
    
    # After drift, state is (toggles // 2) % 2
    # toggles = 2 -> (2//2)%2 = 1
    assert env.apply("x", 5) == "output_for_x_state_1"
    
    env.toggle(6) # toggles = 3 -> (3//2)%2 = 1
    assert env.apply("x", 7) == "output_for_x_state_1"
    
    env.toggle(8) # toggles = 4 -> (4//2)%2 = 0
    assert env.apply("x", 9) == "output_for_x_state_0"
