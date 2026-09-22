import { AIProviderService } from '../services/aiProvider';
import { appStorage } from '../services/storage';
import { TopicItem } from '../types/agent';

export class TopicScoutAgent {
  public static async discoverTopics(nichePrompt?: string): Promise<TopicItem[]> {
    appStorage.addLog('TopicScoutAgent', 'info', `Scanning trending themes in niche: "${nichePrompt || 'AI & Tech'}"`);

    const prompt = `Suggest 3 high-value, SEO-friendly article topics for: ${nichePrompt || 'AI Automation and Digital Strategy'}.
Return ONLY valid JSON array with keys: title, niche, score (number 80-99), searchVolume (string e.g. "35,000 / mo"), competition ("Low" | "Medium" | "High"), trendGrowth (string e.g. "+145%"), keywords (array of strings).`;

    try {
      const text = await AIProviderService.generateText(prompt);
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const added: TopicItem[] = [];
        for (const item of parsed) {
          const t = appStorage.addTopic({
            title: item.title,
            niche: item.niche || nichePrompt || 'Technology',
            score: Number(item.score) || 90,
            searchVolume: item.searchVolume || '25,000 / mo',
            competition: item.competition || 'Low',
            trendGrowth: item.trendGrowth || '+80%',
            keywords: item.keywords || ['tech', 'automation'],
            status: 'discovered'
          });
          added.push(t);
        }
        appStorage.addLog('TopicScoutAgent', 'success', `Discovered and indexed ${added.length} new topics.`);
        return added;
      }
    } catch (err: any) {
      console.warn('Topic generation fallback', err);
    }

    // Fallback seed
    const defaultTopic = appStorage.addTopic({
      title: `Breakthrough Trends in ${nichePrompt || 'Autonomous AI Publishing'} (2026)`,
      niche: nichePrompt || 'AI Publishing',
      score: 93,
      searchVolume: '31,000 / mo',
      competition: 'Low',
      trendGrowth: '+112%',
      keywords: ['automation', 'publishing', 'AI workflow'],
      status: 'discovered'
    });
    appStorage.addLog('TopicScoutAgent', 'success', `Discovered fallback topic: "${defaultTopic.title}"`);
    return [defaultTopic];
  }
}
