import os
import re

def update_version(directory):
    patterns = [
        (re.compile(r'v=2\.3\.[56]'), 'v=2.3'),
        (re.compile(r'appVersion \|\| \'2\.3\.[56]\''), "appVersion || '2.3'"),
        (re.compile(r'Plataforma v2\.3\.[56]'), 'Plataforma v2.3'),
        (re.compile(r'App Territorios v2\.3\.[56]'), 'App Territorios v2.3'),
    ]
    
    for root, dirs, files in os.walk(directory):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if '.git' in dirs:
            dirs.remove('.git')
            
        for file in files:
            if file.endswith(('.js', '.html', '.json')):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    new_content = content
                    for pattern, replacement in patterns:
                        new_content = pattern.sub(replacement, new_content)
                    
                    if new_content != content:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f"Updated: {filepath}")
                except Exception as e:
                    print(f"Error processing {filepath}: {e}")

if __name__ == "__main__":
    update_version(r"d:\_CODE\app-territorios")
