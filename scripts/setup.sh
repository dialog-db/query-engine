# alias to get current branch name
git config --local alias.current 'rev-parse --abbrev-ref HEAD'
# adds git alias to create a patch
git config --local alias.patch '!git push rad HEAD:refs/patches -o patch.message="$1" && git push -u upstream $(git current); #'
