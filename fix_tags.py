import os
import re

def fix_html_tags(content):
    # Fix < div... to <div...
    content = re.sub(r'< ([a-z][a-z0-9]*)', r'<\1', content)
    # Fix </ div... to </div...
    content = re.sub(r'</ ([a-z][a-z0-9]*)', r'</\1', content)
    # Fix < !-- to <!--
    content = re.sub(r'< !--', r'<!--', content)
    # Fix -- > to -->
    content = re.sub(r'-- >', r'-->', content)
    
    # Fix tag endings: <div > to <div>, </div > to </div>
    # We use a non-greedy catch for tag names to avoid eating attributes
    content = re.sub(r'</\s*([a-z][a-z0-9]*)\s*>', r'</\1>', content)
    content = re.sub(r'<\s*([a-z][a-z0-9]*)\s*>', r'<\1>', content)
    
    # Fix spaces before > in tags with attributes: <div class="..." > to <div class="...">
    # This is tricky because we don't want to break spaces inside attribute values.
    # But usually, it's safe to remove space before > if it follows a " or '
    content = re.sub(r'([\'"])\s*>', r'\1>', content)
    
    # Specific CSS properties
    css_props = [
        'font-family', 'box-sizing', 'text-align', 'align-items', 'justify-content',
        'page-break', 'flex-wrap', 'align-content', 'flex-direction', 'white-space',
        'border-bottom', 'min-height', 'padding-bottom', 'text-transform', 'margin-bottom',
        'font-size', 'font-weight', 'min-width', 'object-fit', 'line-height', 'margin-top'
    ]
    for prop in css_props:
        parts = prop.split('-')
        pattern = r'\s*-\s*'.join(re.escape(p) for p in parts)
        content = re.sub(pattern, prop, content)
        
    return content

modules_dir = r'd:\_CODE\app-territorios\modules'
for filename in os.listdir(modules_dir):
    if filename.endswith('.js'):
        path = os.path.join(modules_dir, filename)
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = fix_html_tags(content)
        
        if new_content != content:
            print(f"Fixing {filename}...")
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new_content)
        else:
            print(f"{filename} is clean or already fixed.")
