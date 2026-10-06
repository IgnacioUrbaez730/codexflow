@echo off
set /p FILES=<.git_files
set /p MESSAGE=<.git_message
git add %FILES%
git commit -m "%MESSAGE%"
git push
del .git_files
del .git_message
