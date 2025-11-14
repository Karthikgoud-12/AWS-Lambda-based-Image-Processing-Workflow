
import { GoogleGenAI } from "@google/genai";
import type { ProcessingOptions } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getProcessingDimensions = (size: ProcessingOptions['size']) => {
  switch (size) {
    case 'thumbnail': return { width: 150, height: 150 };
    case 'medium': return { width: 500, height: 500 };
    case 'large': return { width: 1024, height: 1024 };
    default: return { width: 500, height: 500 };
  }
};

export const generateProcessingCode = async (options: ProcessingOptions): Promise<string> => {
  const { width, height } = getProcessingDimensions(options.size);
  const filterName = options.filter === 'grayscale' ? 'L' : 'RGB';

  const prompt = `
You are an expert Python developer specializing in image processing with AWS Lambda.
Generate a complete, self-contained Python Lambda handler function using the Pillow (PIL) library.

The function should:
1. Be named \`lambda_handler\`.
2. Accept \`event\` and \`context\` arguments.
3. For demonstration, open a placeholder image named 'input_image.jpg'.
4. Resize the image to ${width}x${height} pixels.
${options.filter !== 'none' ? `5. Apply a '${options.filter}' filter.` : '5. Perform no color filtering.'}
6. Save the processed image to a placeholder path '/tmp/processed_image.jpg'.
7. Return a success response including the path of the saved file.

Do not include code for fetching from or saving to S3. Focus only on the image manipulation logic within the handler.
Provide only the Python code in a single block, without any introductory text, explanations, or markdown formatting.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating processing code:", error);
    return "Error: Could not generate code.";
  }
};


export const generateMonitoringLogs = async (options: ProcessingOptions, filename: string): Promise<string> => {
    const { width, height } = getProcessingDimensions(options.size);

    const prompt = `
Generate a realistic, multi-line AWS CloudWatch log entry for a Python Lambda function that successfully processed an image from S3.

The log must include the following lines, in order:
1. A START line with a unique RequestId.
2. A line logging 'Processing image: ${filename}'.
3. A line logging 'Applying filter: ${options.filter} and resizing to ${width}x${height}'.
4. A line logging 'Image processing complete. Saved to /tmp/processed_image.jpg'.
5. An END line with the same RequestId.
6. A REPORT line with the same RequestId, and plausible random values for Duration (between 200-800ms), Billed Duration (slightly higher than Duration), Memory Size (128 MB), and Max Memory Used (between 60-100 MB).

Provide only the log text, without any introductory text, explanations or markdown formatting.
`;
  
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error("Error generating logs:", error);
      return "Error: Could not generate logs.";
    }
  };
