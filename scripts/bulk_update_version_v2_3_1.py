import os
import re

def update_version(directory):
    # This will replace ANY version-like string in query params or fallbacks with 2.3.1
    patterns = [
        (re.compile(r'v=2\.3(\.\d+)?'), 'v=2.3.1'),
        (re.compile(r'v=2\.2\.5'), 'v=2.3.1'),
        (re.compile(r'appVersion \|\| \'2\.3(\.\d+)?\''), "appVersion || '2.3.1'"),
        (re.compile(r'appVersion \|\| \'2\.2\.5\''), "appVersion || '2.3.1'"),
        (re.compile(r'Plataforma v2\.3(\.\d+)?'), 'Plataforma v2.3.1'),
        (re.compile(r'Plataforma v2\.2\.5'), 'Plataforma v2.3.1'),
        (re.compile(r'const APP_VERSION = \'2\.3(\.\d+)?\''), "const APP_VERSION = '2.3.1'"),
        (re.compile(r'SYNC_VERSION = \'2\.3(\.\d+)?\''), "SYNC_VERSION = '2.3.1'"),
        (re.compile(r'territorios-hard-sync-v2\.3(\.\d+)?'), 'territorios-hard-sync-v2.3.1'),
    ]
    
    for root, dirs, files in os.walk(directory):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if '.git' in dirs:
            dirs.remove('.git')
        if 'dist' in dirs:
            dirs.remove('dist')
            
        for file in files:
            if file.endswith(('.js', '.html', '.json', '.mjs')):
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
