# bootstrap-config.sh — Repo-specific 1Password configuration
#
# INJECT_FILES: array of "template_path:output_path"
#   Template contains op:// references resolved by `op inject`.

INJECT_FILES=(
  ".env.tpl:.env"
  "functions/.env.tpl:functions/.env"
)
