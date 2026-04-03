import re

with open('src/features/dashboard/queries-comprehensive.ts', 'r') as f:
    content = f.read()

# Completely remove the commented and uncommented block for cashOrdersCount derivation.
pattern = r"  // Derive cashOrdersCount from ordersByPaymentMethod.*?\n  const cashOrdersCount = ordersByPaymentMethod\.reduce\(\(sum, p\) => sum \+ p\._count\.id, 0\); // They are grouped by payment method where status is COMPLETED\.\n"

content = re.sub(pattern, "", content, flags=re.DOTALL)

with open('src/features/dashboard/queries-comprehensive.ts', 'w') as f:
    f.write(content)
