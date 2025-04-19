import * as fs from 'fs';
import * as path from 'path';
import { OpenAI } from 'openai';
import { Manifest, FileItemSchema, TaskSchema, FILE_TYPES, TASK_IDS } from '../../src/types/manifest';

// Configure OpenAI client with DeepSeek API
const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com'
});

// Rich summary interface
interface RichSummary {
  highlights: string[];
  importantTopics: {
    name: string;
    description: string;
  }[];
  overview: string;
}

async function main() {
  try {
    if (process.argv.length < 3) {
      console.error('Usage: ts-node index.ts <content-path>');
      process.exit(1);
    }

    const contentPath = process.argv[2];
    const manifestPath = path.join(contentPath, 'manifest.json');
    
    // Read and parse manifest
    const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    
    // Find the text content file
    const textContentFile = manifest.fileManifest.find(
      file => file.type === FILE_TYPES.TEXT_CONTENT_MD && file.state === 'ready'
    );
    
    if (!textContentFile) {
      throw new Error('No ready text_content_md file found in manifest');
    }
    
    // Read the text content
    const textContent = fs.readFileSync(path.join(contentPath, textContentFile.path), 'utf-8');
    
    console.log(JSON.stringify({ percent: 10 }));
    
    // Generate rich summary using DeepSeek API
    const richSummary = await generateRichSummary(textContent);
    
    console.log(JSON.stringify({ percent: 70 }));
    
    // Save rich summary as JSON
    const richSummaryPath = path.join(contentPath, 'summaries/rich_summary.json');
    fs.mkdirSync(path.dirname(richSummaryPath), { recursive: true });
    fs.writeFileSync(richSummaryPath, JSON.stringify(richSummary, null, 2));
    
    // Save plain summary as markdown
    const plainSummaryPath = path.join(contentPath, 'summaries/summary.md');
    fs.writeFileSync(plainSummaryPath, generatePlainSummary(richSummary));
    
    console.log(JSON.stringify({ percent: 90 }));
    
    // Update manifest with new files
    updateManifest(manifest, richSummaryPath, plainSummaryPath, textContentFile.path, contentPath);
    
    console.log(JSON.stringify({ percent: 100 }));
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

async function generateRichSummary(textContent: string): Promise<RichSummary> {
  const prompt = `
I need you to analyze the following content and generate a structured summary with these components:
1. 3-5 key highlights (most important points)
2. 5-7 important topics mentioned (with brief descriptions)
3. A concise overview paragraph (max 150 words)

The format should be JSON with these fields:
- highlights: string array of key points
- importantTopics: array of objects with name and description fields
- overview: string with a concise summary

Content to analyze:
${textContent.substring(0, 12000)} ${textContent.length > 12000 ? '... (content truncated)' : ''}
`;

  const completion = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: 'You are an expert content analyzer. Extract key insights and create structured summaries.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 2000
  });

  const responseText = completion.choices[0].message.content || '';
  
  try {
    // Extract JSON from response, handling cases where it might be wrapped in markdown code blocks
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                      responseText.match(/```\n([\s\S]*?)\n```/) || 
                      [null, responseText];
    
    const jsonContent = jsonMatch[1] || responseText;
    return JSON.parse(jsonContent);
  } catch (error) {
    console.error('Failed to parse AI response as JSON:', responseText);
    
    // Fallback to a minimal structure if parsing fails
    return {
      highlights: ["Failed to generate structured highlights"],
      importantTopics: [{ 
        name: "Error", 
        description: "The AI response couldn't be parsed correctly" 
      }],
      overview: "There was an error processing the content summary. Please try again."
    };
  }
}

function generatePlainSummary(richSummary: RichSummary): string {
  let markdown = `# Summary\n\n`;
  markdown += `${richSummary.overview}\n\n`;
  
  markdown += `## Highlights\n\n`;
  richSummary.highlights.forEach(highlight => {
    markdown += `- ${highlight}\n`;
  });
  
  markdown += `\n## Important Topics\n\n`;
  richSummary.importantTopics.forEach(topic => {
    markdown += `### ${topic.name}\n`;
    markdown += `${topic.description}\n\n`;
  });
  
  return markdown;
}

function updateManifest(
  manifest: Manifest, 
  richSummaryPath: string, 
  plainSummaryPath: string, 
  textContentPath: string,
  contentPath: string
) {
  const now = new Date().toISOString();
  const relativeRichSummaryPath = path.relative(contentPath, richSummaryPath);
  const relativePlainSummaryPath = path.relative(contentPath, plainSummaryPath);
  
  // Add rich summary to file manifest
  const richSummaryFile = FileItemSchema.parse({
    type: FILE_TYPES.SUMMARY_RICH_JSON,
    version: 1,
    path: relativeRichSummaryPath,
    state: 'ready',
    generatedBy: 'ai-summary@0.1.0',
    derivedFrom: [textContentPath],
    metadata: {
      wordCount: 0, // We could calculate this
      estimatedReadingTime: 0 // We could estimate this
    }
  });
  
  // Add plain summary to file manifest
  const plainSummaryFile = FileItemSchema.parse({
    type: FILE_TYPES.SUMMARY_MD,
    version: 1,
    path: relativePlainSummaryPath,
    state: 'ready',
    generatedBy: 'ai-summary@0.1.0',
    derivedFrom: [textContentPath],
    metadata: null
  });
  
  // Update the task status
  let summaryTask = manifest.tasks.find(task => task.id === TASK_IDS.GENERATE_RICH_SUMMARY);
  
  if (summaryTask) {
    // Update existing task
    summaryTask.state = 'done';
    summaryTask.percent = 100;
    summaryTask.updatedAt = now;
    summaryTask.relatedOutput = relativeRichSummaryPath;
  } else {
    // Create new task
    summaryTask = TaskSchema.parse({
      id: TASK_IDS.GENERATE_RICH_SUMMARY,
      title: 'Generate AI Summary',
      state: 'done',
      percent: 100,
      relatedOutput: relativeRichSummaryPath,
      startedAt: now,
      updatedAt: now,
      error: null,
      context: {
        model: 'deepseek-chat'
      }
    });
    manifest.tasks.push(summaryTask);
  }
  
  // Find and replace existing files or add new ones
  const richSummaryIndex = manifest.fileManifest.findIndex(file => file.type === FILE_TYPES.SUMMARY_RICH_JSON);
  if (richSummaryIndex >= 0) {
    manifest.fileManifest[richSummaryIndex] = richSummaryFile;
  } else {
    manifest.fileManifest.push(richSummaryFile);
  }
  
  const plainSummaryIndex = manifest.fileManifest.findIndex(file => file.type === FILE_TYPES.SUMMARY_MD);
  if (plainSummaryIndex >= 0) {
    manifest.fileManifest[plainSummaryIndex] = plainSummaryFile;
  } else {
    manifest.fileManifest.push(plainSummaryFile);
  }
  
  // Update manifest timestamp
  manifest.updatedAt = now;
  
  // Write updated manifest back to file
  fs.writeFileSync(path.join(contentPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

main().catch(console.error); 