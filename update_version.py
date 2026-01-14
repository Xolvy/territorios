import os
import re

NEW_VERSION = '1.9.3.4'

def update_version_params(content):
    # Update ?v=X.X.X to ?v=NEW_VERSION
    content = re.sub(r'\?v=[0-9.]+', f'?v={NEW_VERSION}', content)
    # Also update APP_VERSION constant in app.js
    content = re.sub(r"const APP_VERSION = '[0-9.]+';", f"const APP_VERSION = '{NEW_VERSION}';", content)
    # Also update CACHE_NAME in service-worker.js
    content = re.sub(r"const CACHE_NAME = 'territorios-jw-v[0-9.]+';", f"const CACHE_NAME = 'territorios-jw-v{NEW_VERSION}';", content)
    return content

files_to_update = [
    r'd:\_CODE\app-territorios\app.js',
    r'd:\_CODE\app-territorios\public\service-worker.js',
    r'd:\_CODE\app-territorios\modules\admin-dashboard.js',
    r'd:\_CODE\app-territorios\modules\conductor-dashboard.js',
    r'd:\_CODE\app-territorios\modules\report-s13.js',
    r'd:\_CODE\app-territorios\modules\analytics-view.js',
    r'd:\_CODE\app-territorios\modules\login.js',
    r'd:\_CODE\app-territorios\firebase-config.js'
]

for path in files_to_update:
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = update_version_params(content)
        
        if new_content != content:
            print(f"Updating version in {os.path.basename(path)}...")
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new_content)
    else:
        print(f"File not found: {path}")
