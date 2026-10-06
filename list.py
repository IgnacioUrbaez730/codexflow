import os

with open('scratch.txt', 'w') as f:
    for root, dirs, files in os.walk('frontend/src'):
        for file in files:
            f.write(os.path.join(root, file) + '\n')
