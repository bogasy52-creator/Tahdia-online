"""Jobs for the hero characters (32.0.0): name, model index, accent, eye glow, second glow."""
import json
H = [('desert', 0, '#b8322c', '#ffc14d', '#ff7a3d'), ('ninja', 1, '#c0262d', '#ff3341', '#ffb03b'),
     ('robot', 2, '#3fb6ff', '#4dd9ff', '#ff4fd8'), ('knight', 3, '#d42a36', '#7fe3ff', '#ffd36b'),
     ('falcon', 4, '#e8b04a', '#ffb340', '#ff7a3d'), ('astronaut', 5, '#e05a2a', '#66e0ff', '#ff5a7a'),
     ('samurai', 6, '#b8202b', '#ff6a3d', '#ffd36b'), ('viking', 7, '#6b3a1f', '#7fd0ff', '#ffd36b'),
     ('diver', 8, '#c98a3a', '#7fe6d6', '#ffd36b'), ('racer', 9, '#e23a2c', '#ffffff', '#ffd36b'),
     ('gladiator', 10, '#c2262d', '#ff8a3d', '#ffd36b'), ('cyber', 11, '#1b1d2a', '#21e6ff', '#ff3fb0')]
jobs = [{"name": n, "hero": i, "color": c, "glow": g, "glow2": g2, "elev": 0.22, "yaw": 0.38,
         "frame": [-0.64, 0.64, -0.12, 1.62], "w": 600, "h": 816} for n, i, c, g, g2 in H]
json.dump(jobs, open('jobs-heroes.json', 'w'))
print(len(jobs))
