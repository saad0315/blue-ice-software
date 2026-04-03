import re

with open('src/features/dashboard/queries-comprehensive.ts', 'r') as f:
    content = f.read()

# I need to see where totalRevenue is being declared.
# I will use a simple regex to find totalRevenue declarations
declarations = re.findall(r"const\s+totalRevenue\s*=\s*", content)
if len(declarations) > 1:
    print("Multiple totalRevenue declarations found.")
