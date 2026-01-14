import os
import re

def update_version(new_version):
    # Files to update
    files = [
        r'app.js',
        r'index.html',
        r'public/service-worker.js',
        r'modules/admin-dashboard.js',
        r'modules/conductor-dashboard.js',
        r'modules/report-s13.js',
        r'modules/analytics-view.js',
        r'modules/login.js',
        r'firebase-config.js'
    ]
    
    # 1. Update constants like APP_VERSION = '...' or version: '...'
    version_patterns = [
        (r"(APP_VERSION\s*=\s*['\"])[^'\"]+(['\"])", r"\g<1>" + new_version + r"\g<2>"),
        (r"(version\s*:\s*['\"])[^'\"]+(['\"])", r"\g<1>" + new_version + r"\g<2>"),
        (r"(territorios-jw-v)[0-9.]+", r"\g<1>" + new_version)
    ]
    
    # 2. Update import version parameters ?v=...
    import_pattern = (r"(\?v=)[0-9.]+", r"\g<1>" + new_version)
    
    for rel_path in files:
        path = os.path.join(r'd:\_CODE\app-territorios', rel_path)
        if not os.path.exists(path):
            print(f"File not found: {path}")
            continue
            
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = content
        for pattern, replacement in version_patterns:
            new_content = re.sub(pattern, replacement, new_content)
        
        new_content = re.sub(import_pattern[0], import_pattern[1], new_content)
        
        if new_content != content:
            print(f"Updating version in {rel_path}...")
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new_content)
        else:
            print(f"No changes needed for {rel_path}")

update_version('1.9.5')
