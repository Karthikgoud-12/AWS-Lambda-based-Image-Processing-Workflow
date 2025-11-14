import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ProcessingOptions, WorkflowStep } from './types';
import { generateProcessingCode, generateMonitoringLogs } from './services/geminiService';
import { S3Icon, LambdaIcon, CloudWatchIcon, UploadIcon, ArrowRightIcon, CheckCircleIcon, CodeBracketIcon, PhotoIcon } from './components/icons';

const applyImageProcessing = (
  imageUrl: string,
  options: ProcessingOptions
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }

      const dimensions = {
          'thumbnail': 150,
          'medium': 500,
          'large': 1024
      }[options.size];

      canvas.width = dimensions;
      canvas.height = dimensions;
      
      let filterCss = '';
      switch (options.filter) {
        case 'grayscale': filterCss = 'grayscale(100%)'; break;
        case 'sepia': filterCss = 'sepia(100%)'; break;
        case 'invert': filterCss = 'invert(100%)'; break;
        default: filterCss = 'none';
      }
      ctx.filter = filterCss;
      
      ctx.drawImage(img, 0, 0, dimensions, dimensions);
      resolve(canvas.toDataURL('image/jpeg'));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
};


const App = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [options, setOptions] = useState<ProcessingOptions>({ size: 'medium', filter: 'none' });
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(WorkflowStep.UPLOAD);
  const [pythonCode, setPythonCode] = useState<string>('');
  const [cloudwatchLogs, setCloudwatchLogs] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'code' | 'logs'>('code');

  useEffect(() => {
    if (imageFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(imageFile);
    } else {
      setImageUrl(null);
    }
  }, [imageFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
      resetWorkflow();
    }
  };
  
  const resetWorkflow = () => {
    setProcessedImageUrl(null);
    setCurrentStep(WorkflowStep.UPLOAD);
    setPythonCode('');
    setCloudwatchLogs('');
    setError(null);
  }

  const handleStartWorkflow = useCallback(async () => {
    if (!imageFile || !imageUrl) return;

    setIsLoading(true);
    resetWorkflow();

    try {
      // 1. Simulate Upload
      await new Promise(res => setTimeout(res, 500));
      setCurrentStep(WorkflowStep.PROCESS);

      // 2. Kick off parallel tasks
      const codePromise = generateProcessingCode(options);
      const logsPromise = generateMonitoringLogs(options, imageFile.name);
      const processedImagePromise = applyImageProcessing(imageUrl, options);

      const [codeResult, logsResult, processedImageResult] = await Promise.allSettled([
        codePromise, logsPromise, processedImagePromise
      ]);

      if(codeResult.status === 'fulfilled') setPythonCode(codeResult.value);
      else throw new Error("Failed to generate code.");

      if(processedImageResult.status === 'fulfilled') setProcessedImageUrl(processedImageResult.value);
      else throw new Error("Failed to process image.");

      // 3. Move to monitoring step
      setCurrentStep(WorkflowStep.MONITOR);
      await new Promise(res => setTimeout(res, 500));
      
      if(logsResult.status === 'fulfilled') setCloudwatchLogs(logsResult.value);
      else throw new Error("Failed to generate logs.");

      // 4. Finish
      setCurrentStep(WorkflowStep.DONE);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during the workflow.');
      setCurrentStep(WorkflowStep.UPLOAD);
    } finally {
      setIsLoading(false);
    }
  }, [imageFile, imageUrl, options]);

  const isButtonDisabled = !imageFile || isLoading;

  return (
    <div className="min-h-screen bg-aws-paper dark:bg-aws-squid-ink text-gray-800 dark:text-gray-200 font-sans">
      <header className="bg-white dark:bg-gray-800 shadow-md p-4">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold text-aws-orange">AWS Lambda Image Processing Workflow</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">A visual simulation of a serverless image pipeline with Gemini-generated code and logs.</p>
        </div>
      </header>

      <main className="container mx-auto p-4 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col gap-6 animate-fade-in">
            <div>
              <h2 className="text-xl font-semibold mb-3 border-b pb-2">1. Upload Image</h2>
              <div className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 dark:border-gray-100/25 px-6 py-10">
                <div className="text-center">
                  {imageUrl ? (
                     <img src={imageUrl} alt="Preview" className="mx-auto h-32 w-32 object-cover rounded-md" />
                  ) : (
                    <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" aria-hidden="true" />
                  )}
                  <div className="mt-4 flex text-sm leading-6 text-gray-600 dark:text-gray-400">
                    <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-semibold text-aws-orange focus-within:outline-none focus-within:ring-2 focus-within:ring-aws-orange focus-within:ring-offset-2 hover:text-orange-500">
                      <span>Upload a file</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs leading-5 text-gray-600 dark:text-gray-400">PNG, JPG, GIF up to 10MB</p>
                  {imageFile && <p className="text-sm mt-2 text-green-600 dark:text-green-400">Selected: {imageFile.name}</p>}
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-3 border-b pb-2">2. Set Processing Options</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="size" className="block text-sm font-medium leading-6">Size</label>
                  <select id="size" value={options.size} onChange={(e) => setOptions(prev => ({ ...prev, size: e.target.value as ProcessingOptions['size'] }))} className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 bg-white dark:bg-gray-700 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-aws-orange sm:text-sm sm:leading-6">
                    <option value="thumbnail">Thumbnail (150x150)</option>
                    <option value="medium">Medium (500x500)</option>
                    <option value="large">Large (1024x1024)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="filter" className="block text-sm font-medium leading-6">Filter</label>
                  <select id="filter" value={options.filter} onChange={(e) => setOptions(prev => ({ ...prev, filter: e.target.value as ProcessingOptions['filter'] }))} className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 bg-white dark:bg-gray-700 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-aws-orange sm:text-sm sm:leading-6">
                    <option value="none">None</option>
                    <option value="grayscale">Grayscale</option>
                    <option value="sepia">Sepia</option>
                    <option value="invert">Invert</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-3 border-b pb-2">3. Start Workflow</h2>
              <button onClick={handleStartWorkflow} disabled={isButtonDisabled} className={`w-full flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors ${isButtonDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-aws-orange hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aws-orange'}`}>
                {isLoading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                {isLoading ? 'Processing...' : 'Start Workflow'}
              </button>
              {error && <p className="text-sm mt-2 text-red-500">{error}</p>}
            </div>
          </div>
          
          {/* Right Column: Visualization & Results */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col gap-6 animate-fade-in">
            <div>
                <h2 className="text-xl font-semibold mb-4 border-b pb-2">Workflow Status</h2>
                <div className="flex items-center justify-around text-center">
                    {Object.values(WorkflowStep).filter(v => typeof v === 'string').map((step, index) => {
                        const isCompleted = currentStep > index;
                        const isActive = currentStep === index;
                        const iconColor = isCompleted ? 'text-green-500' : isActive ? 'text-aws-orange' : 'text-gray-400';
                        const textColor = isCompleted ? 'text-green-600 dark:text-green-400' : isActive ? 'text-aws-orange' : 'text-gray-500 dark:text-gray-400';
                        const Icon = [S3Icon, LambdaIcon, CloudWatchIcon, CheckCircleIcon][index];

                        return (
                            <React.Fragment key={step}>
                                <div className="flex flex-col items-center">
                                    <div className={`relative rounded-full p-3 bg-gray-100 dark:bg-gray-700 ${isActive && 'animate-pulse-fast'}`}>
                                        <Icon className={`h-8 w-8 ${iconColor}`} />
                                        {isCompleted && <CheckCircleIcon className="absolute -top-1 -right-1 h-5 w-5 text-green-500 bg-white dark:bg-gray-800 rounded-full" />}
                                    </div>
                                    <p className={`mt-2 text-sm font-medium ${textColor}`}>{step}</p>
                                </div>
                                {index < 3 && <ArrowRightIcon className={`h-6 w-6 mx-2 ${isCompleted ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`} />}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[150px]">
              <div className="text-center">
                <h3 className="font-semibold">Original</h3>
                <div className="mt-2 aspect-square w-full rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  {imageUrl ? <img src={imageUrl} className="max-h-full max-w-full object-contain rounded-md" /> : <PhotoIcon className="h-12 w-12 text-gray-400" />}
                </div>
              </div>
              <div className="text-center">
                <h3 className="font-semibold">Processed</h3>
                <div className="mt-2 aspect-square w-full rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  {isLoading && currentStep > 0 && <svg className="animate-spin h-8 w-8 text-aws-orange" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                  {processedImageUrl && <img src={processedImageUrl} className="max-h-full max-w-full object-contain rounded-md" />}
                </div>
              </div>
            </div>

            <div className="flex-grow flex flex-col">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                  <button onClick={() => setActiveTab('code')} className={`${activeTab === 'code' ? 'border-aws-orange text-aws-orange' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}>
                    <CodeBracketIcon className="h-5 w-5" /> Lambda Code
                  </button>
                  <button onClick={() => setActiveTab('logs')} className={`${activeTab === 'logs' ? 'border-aws-orange text-aws-orange' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}>
                    <CloudWatchIcon className="h-5 w-5" /> CloudWatch Logs
                  </button>
                </nav>
              </div>
              <div className="mt-4 flex-grow">
                 <pre className="text-xs bg-gray-900 text-white p-4 rounded-md overflow-x-auto h-64 font-mono">
                    <code className="whitespace-pre-wrap">
                      {activeTab === 'code' ? (pythonCode || "Python code for the Lambda function will appear here...") : (cloudwatchLogs || "Simulated CloudWatch logs will appear here...")}
                    </code>
                 </pre>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
