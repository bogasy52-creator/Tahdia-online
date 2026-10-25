"""Jobs for the zoom challenge renders (32.0.0): object, camera and studio colours."""
import json
# name, object index, look-at, distance, elevation, yaw, vertical fov, backdrop, floor, tint
O = [
    ('basketball', 0, [0, .48, 0], 3.0, .32, .3, .5, '#c9d3df', '#b8c2cf', None),
    ('soccer', 1, [0, .48, 0], 3.0, .3, .2, .5, '#8fd19e', '#6fb27e', None),
    ('tennis', 2, [0, .4, 0], 2.6, .32, .2, .5, '#3d6fb8', '#2f5da0', None),
    ('rubik', 3, [0, .46, 0], 3.4, .5, .2, .5, '#e9e4da', '#d8d1c4', None),
    ('donut', 4, [0, .16, 0], 2.6, .75, .1, .5, '#9ad8e6', '#86c5d4', None),
    ('watermelon', 5, [0, .36, 0], 3.0, .18, .35, .5, '#f3e7c9', '#e4d6b4', None),
    ('bulb', 6, [0, .55, 0], 3.4, .22, .2, .5, '#1e2433', '#151a26', None),
    ('pencil', 7, [0, .08, 0], 2.8, .62, .0, .5, '#d7e6f2', '#c4d6e5', '#f2b71c'),
    ('padlock', 8, [0, .36, 0], 3.0, .3, .25, .5, '#2f3a4a', '#263040', None),
    ('hourglass', 9, [0, .55, 0], 3.6, .18, .3, .5, '#efe2c8', '#ddcdae', None),
    ('trophy', 10, [0, .5, 0], 3.4, .3, .2, .5, '#1d2a44', '#16203a', None),
    ('dallah', 11, [0, .47, 0], 3.5, .22, .0, .5, '#7a2e2e', '#6a2626', None),
    ('dates', 12, [0, .1, 0], 2.3, .78, .2, .5, '#e9dcc4', '#d9c8a8', None),
    ('mushroom', 13, [0, .42, 0], 3.0, .25, .2, .5, '#bfe0b0', '#a5cc94', None),
    ('icecream', 14, [0, .58, 0], 3.0, .2, .2, .5, '#ffd6e0', '#ffd6e0', None),
    ('strawberry', 15, [0, .3, 0], 2.7, .35, .3, .5, '#fff1c9', '#f0deb0', None),
    ('magnet', 16, [0, .33, 0], 3.0, .3, .2, .5, '#d9e2ec', '#c6d1dd', None),
    ('bell', 17, [0, .45, 0], 3.2, .25, .2, .5, '#20304a', '#18253c', None),
    ('die', 18, [0, .3, 0], 2.6, .55, .0, .5, '#2c6e63', '#245c52', None),
    ('cactus', 19, [0, .5, 0], 3.4, .22, .2, .5, '#f2d9b8', '#e3c69f', None),
]
jobs = []
for n, o, t, d, e, y, f, bg, fl, tint in O:
    j = {'name': n, 'obj': o, 'target': t, 'dist': d, 'elev': e, 'yaw': y, 'fov': f, 'bg': bg, 'floor': fl, 'w': 1350, 'h': 900}
    if tint:
        j['tint'] = tint
    if n == 'icecream':
        j['floorOn'] = 0  # it floats, like a cone held up in a studio
    jobs.append(j)
json.dump(jobs, open('jobs-zoom.json', 'w'))
print(len(jobs))
