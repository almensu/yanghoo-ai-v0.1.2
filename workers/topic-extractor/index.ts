import * as fs from 'fs';
import * as path from 'path';
import { OpenAI } from 'openai';
import { Manifest, FileItemSchema, TaskSchema, FILE_TYPES, TASK_IDS } from '../../src/types/manifest';

// Configure OpenAI client with DeepSeek API
const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com'
});

// Topic tags interface
interface TopicTags {
  topics: string[];
  categories: Record<string, string[]>;
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
    
    // Find the rich summary JSON file
    const richSummaryFile = manifest.fileManifest.find(
      file => file.type === FILE_TYPES.SUMMARY_RICH_JSON && file.state === 'ready'
    );
    
    if (!richSummaryFile) {
      throw new Error('No ready summary_rich_json file found in manifest');
    }
    
    // Read the rich summary
    const richSummaryPath = path.join(contentPath, richSummaryFile.path);
    const richSummary = JSON.parse(fs.readFileSync(richSummaryPath, 'utf-8'));
    
    console.log(JSON.stringify({ percent: 10 }));
    
    // Extract topics from the rich summary
    const topicTags = await extractTopics(richSummary);
    
    console.log(JSON.stringify({ percent: 70 }));
    
    // Save topic tags as JSON
    const topicTagsPath = path.join(contentPath, 'knowledge/topic_tags.json');
    fs.mkdirSync(path.dirname(topicTagsPath), { recursive: true });
    fs.writeFileSync(topicTagsPath, JSON.stringify(topicTags, null, 2));
    
    console.log(JSON.stringify({ percent: 90 }));
    
    // Update manifest with new file
    updateManifest(manifest, topicTagsPath, richSummaryFile.path, contentPath, topicTags.topics.length);
    
    // Also update library.json with tags
    updateLibrary(contentPath, manifest.hashId, topicTags.topics);
    
    console.log(JSON.stringify({ percent: 100 }));
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

async function extractTopics(richSummary: any): Promise<TopicTags> {
  // If the rich summary already has importantTopics, use those as a basis
  let initialTopics: string[] = [];
  
  if (richSummary.importantTopics && Array.isArray(richSummary.importantTopics)) {
    initialTopics = richSummary.importantTopics.map(topic => topic.name);
  }
  
  const prompt = `
I need you to analyze the given highlights and important topics from a content summary and extract concise topic tags.

The tags should be:
1. Short (1-3 words)
2. Relevant to the content's main themes
3. Useful for categorization and filtering
4. Include a mix of general and specific topics
5. Include both technical and conceptual terms where relevant

Please organize the topics into categories and output in this JSON format:
{
  "topics": ["topic1", "topic2", "topic3", ...],
  "categories": {
    "category1": ["topic1", "topic2"],
    "category2": ["topic3", "topic4"],
    ...
  }
}

Content highlights:
${JSON.stringify(richSummary.highlights)}

Important topics:
${JSON.stringify(richSummary.importantTopics)}

Initial suggested topics (refine these): ${initialTopics.join(', ')}
`;

  const completion = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: 'You are an expert content tagger. Extract key topics from content for categorization.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 1000
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
      topics: initialTopics.length > 0 ? initialTopics : ["content", "general"],
      categories: {
        "General": initialTopics.length > 0 ? initialTopics : ["content", "general"]
      }
    };
  }
}

function updateManifest(
  manifest: Manifest, 
  topicTagsPath: string, 
  richSummaryPath: string,
  contentPath: string,
  tagCount: number
) {
  const now = new Date().toISOString();
  const relativeTopicTagsPath = path.relative(contentPath, topicTagsPath);
  
  // Add topic tags to file manifest
  const topicTagsFile = FileItemSchema.parse({
    type: FILE_TYPES.TOPIC_TAGS_JSON,
    version: 1,
    path: relativeTopicTagsPath,
    state: 'ready',
    generatedBy: 'topic-extractor@0.1.0',
    derivedFrom: [richSummaryPath],
    metadata: {
      type: 'topic_tags_json',
      tagCount: tagCount,
      categories: {} // Will be populated from the JSON if needed
    }
  });
  
  // Update task status
  let extractTopicsTask = manifest.tasks.find(task => task.id === TASK_IDS.EXTRACT_TOPICS);
  
  if (extractTopicsTask) {
    // Update existing task
    extractTopicsTask.state = 'done';
    extractTopicsTask.percent = 100;
    extractTopicsTask.updatedAt = now;
    extractTopicsTask.relatedOutput = relativeTopicTagsPath;
  } else {
    // Create new task
    extractTopicsTask = TaskSchema.parse({
      id: TASK_IDS.EXTRACT_TOPICS,
      title: 'Extract Topic Tags',
      state: 'done',
      percent: 100,
      relatedOutput: relativeTopicTagsPath,
      startedAt: now,
      updatedAt: now,
      error: null,
      context: {
        model: 'deepseek-chat'
      }
    });
    manifest.tasks.push(extractTopicsTask);
  }
  
  // Find and replace existing file or add new one
  const topicTagsIndex = manifest.fileManifest.findIndex(file => file.type === FILE_TYPES.TOPIC_TAGS_JSON);
  if (topicTagsIndex >= 0) {
    manifest.fileManifest[topicTagsIndex] = topicTagsFile;
  } else {
    manifest.fileManifest.push(topicTagsFile);
  }
  
  // Update manifest timestamp
  manifest.updatedAt = now;
  
  // Write updated manifest back to file
  fs.writeFileSync(path.join(contentPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

function updateLibrary(contentPath: string, hashId: string, topics: string[]) {
  try {
    // Get path to library.json
    const libraryPath = path.join(contentPath, '..', 'library.json');
    
    if (fs.existsSync(libraryPath)) {
      // Read and parse library.json
      const library = JSON.parse(fs.readFileSync(libraryPath, 'utf-8'));
      
      // Find the item with the matching hashId
      const itemIndex = library.items.findIndex((item: any) => item.hashId === hashId);
      
      if (itemIndex >= 0) {
        // Update the tags
        library.items[itemIndex].tags = topics;
        
        // Update the updatedAt timestamp
        library.updatedAt = new Date().toISOString();
        
        // Write the updated library back to file
        fs.writeFileSync(libraryPath, JSON.stringify(library, null, 2));
      }
    }
  } catch (error) {
    console.error('Error updating library.json:', error);
    // Continue execution even if library update fails
  }
}

main().catch(console.error); 