// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Replace with your OpenAI API key
const config = vscode.workspace.getConfiguration('yourExtension');
const OPENAI_API_KEY = config.get('openAiApiKey');

async function generateSwaggerDoc(routeCode) {
	if(OPENAI_API_KEY === 'test') {
		return `
			/**
			 * POST /rest/addresses
			 * @summary Create a new address
			 * @tags Addresses
			 * @param {Address} request.body - The address to create
			 * @return {Address} 200 - Address - application/json
			 * @return {object} 400 - Bad request response - application/json
			 */
		`
	}

    const prompt = `Generate jsDoc format Swagger documentation for the following Express route:\n\n${routeCode}`;
    const response = await axios.post(
        'https://api.openai.com/v1/engines/davinci-codex/completions',
        {
            prompt: prompt,
            max_tokens: 150,
            n: 1,
            stop: null,
            temperature: 0.5,
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
        }
    );

    return response.data.choices[0].text.trim();
}

// Function to extract the service file name and method name from the code snippet
function extractServiceInfo(codeSnippet) {
    const match = codeSnippet.match(/req\.(\w+)\.(\w+)\(/);
    if (match && match[1] && match[2]) {
        return {
            serviceFileName: match[1],
            methodName: match[2]
        };
    }
    return null;
}

// Function to read the service file and get the method code
function getMethodCode(serviceFilePath, methodName) {
    const serviceFileContent = fs.readFileSync(serviceFilePath, 'utf-8');
    const methodRegex = new RegExp(`async ${methodName}\\([\\s\\S]*?\\n\\}`, 'g');
    const match = methodRegex.exec(serviceFileContent);
    if (match) {
        return match[0];
    }
    return null;
}

// Main function
function main(codeSnippet, servicesFolderPath) {
    const serviceInfo = extractServiceInfo(codeSnippet);
    if (!serviceInfo) {
        console.error('Service file reference not found in the code snippet.');
        return;
    }

    const serviceFilePath = path.join(servicesFolderPath, `${serviceInfo.serviceFileName}.js`);
    if (!fs.existsSync(serviceFilePath)) {
        console.error(`Service file not found: ${serviceFilePath}`);
        return;
    }

    const methodCode = getMethodCode(serviceFilePath, serviceInfo.methodName);
    if (methodCode) {
        console.log(`${codeSnippet.trim()}\n\nFound method in ${serviceInfo.serviceFileName}.js:\n\n${methodCode}`);
    } else {
        console.log(`${codeSnippet.trim()}\n\nThe method '${serviceInfo.methodName}' is NOT exposed in ${serviceInfo.serviceFileName}.js`);
    }

	return `${codeSnippet} \n ${methodCode}`;
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	console.log('Congratulations, your extension "smart-doc" is now active!');

	let disposable = vscode.commands.registerCommand('smartdoc.generateSmartDoc', async () => {
        const editor = vscode.window.activeTextEditor;


		if (OPENAI_API_KEY) {
			if (editor) {
				const document = editor.document;
				const selection = editor.selection;
				const codeSnippet = document.getText(selection);
	
				// This path will be set in the configurations
				const currentWorkspace = vscode.workspace.workspaceFolders[0].uri.fsPath;
				const servicesFolderPath = path.join(currentWorkspace, 'services');
	
				// The output goes directly to chatGPT
				const output = main(codeSnippet, servicesFolderPath);
				const swaggerDoc = await generateSwaggerDoc(output);

                vscode.window.showInformationMessage('Swagger documentation generated!');
                editor.edit(editBuilder => {
                    editBuilder.insert(selection.start, `${swaggerDoc}\n`);
                });
			}
		} else {
			vscode.window.showInformationMessage(`No API KEY was provided!`);
		}

    });

    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
