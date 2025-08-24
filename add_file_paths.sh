#!/bin/bash

# Script to add file path comments at the top of TypeScript and JavaScript files
# It will add the comment or replace incorrect ones

# Find all TypeScript and JavaScript files, excluding node_modules, .next, and .git directories
find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | grep -v "node_modules" | grep -v ".next" | grep -v ".git" | while read -r file; do
  # Get the relative path
  relative_path=$(echo "$file" | sed 's|^\./||')
  
  # Check if the file already has the correct path comment at the top
  first_line=$(head -n 1 "$file")
  
  if [[ "$first_line" != "// $relative_path" ]]; then
    echo "Processing $relative_path"
    
    # Check if the first line is a path comment (starts with '//' and contains a path)
    if [[ "$first_line" =~ ^//\ .*\.(ts|tsx|js|jsx)$ ]]; then
      echo "  Replacing incorrect path comment"
      # Replace the first line with the correct path comment
      sed -i "1s|.*|// $relative_path|" "$file"
    else
      echo "  Adding new path comment"
      # Create temporary file with the comment and original content
      temp_file=$(mktemp)
      echo "// $relative_path" > "$temp_file"
      cat "$file" >> "$temp_file"
      
      # Replace the original file with the modified one
      mv "$temp_file" "$file"
    fi
  else
    echo "Correct path comment already exists in $relative_path"
  fi
done

echo "Finished adding file path comments to TypeScript and JavaScript files." 