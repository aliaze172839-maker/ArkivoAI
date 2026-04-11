import os

def replace_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = content.replace('DocuMind', 'Arkivo')
        new_content = new_content.replace('Documind', 'Arkivo')
        new_content = new_content.replace('documind', 'arkivo')
        
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {filepath}")
    except Exception as e:
        pass

for root, dirs, files in os.walk(r'e:\fiverocr'):
    if '.git' in root or '__pycache__' in root or 'node_modules' in root:
        continue
    for file in files:
        if file.endswith(('.js', '.html', '.css', '.py', '.md')):
            replace_in_file(os.path.join(root, file))
