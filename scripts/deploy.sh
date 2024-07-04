echo "Clearing Folder"

rm -rf compiledContracts && mkdir compiledContracts

echo "Folder Cleared"

node ./deploy/compile.js

echo "Compilation Complete"

node ./deploydeploy.js

echo "Deployment Complete"
