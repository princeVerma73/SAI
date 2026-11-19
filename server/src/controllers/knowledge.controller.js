import { queryClinicalRAG } from '../services/rag.service.js';
import { checkMedicalMyth } from '../services/misinformation.service.js';
import { detectNutritionalDeficiency } from '../services/nutrition.service.js';
import { env } from '../config/env.js';

export const askMedicalRAG = async (req, res) => {
  try {
    const { query, image_b64, mime_type, history } = req.body;
    if ((!query || !query.trim()) && !image_b64) {
      return res.status(400).json({
        success: false,
        error: { message: 'Query string or image is required.' },
      });
    }

    // 1. If an image is provided OR conversation history exists with multimodal context, route to Multimodal Vision
    if (image_b64 || (history && history.some((h) => h.image_b64))) {
      try {
        const aiResponse = await fetch(`${env.AI_SERVICE_URL}/api/rag/chat-multimodal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query || 'Analyze this image', image_b64, mime_type, history }),
          signal: AbortSignal.timeout(25000),
        });

        if (aiResponse.ok) {
          const mData = await aiResponse.json();
          return res.status(200).json({
            success: true,
            data: {
              query,
              retrievedGuideline: {
                title: 'Clinical Visual Triage (Gemini Vision)',
                organization: 'HealthAssist Visual Diagnostics',
                summary: mData.answer,
                keyPoints: ['Visual triage analysis', 'First aid recommendations', 'Emergency red flags'],
              },
              citations: ['Clinical Visual Inspection (Gemini Vision)'],
              workflow_trace: ['__start__', 'inspect_image', 'triage_wound_rash', 'first_aid_plan', 'check_red_flags', '__end__'],
              is_self_rag: true,
              is_multimodal: true,
            },
          });
        }
      } catch (e) {
        console.warn('[Knowledge Controller] Multimodal vision service call failed:', e.message);
      }
    }

    // 2. Standard Self-RAG microservice query (with FAISS + Hybrid Search + Cross-Encoder)
    try {
      const aiResponse = await fetch(`${env.AI_SERVICE_URL}/api/rag/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(8000),
      });

      if (aiResponse.ok) {
        const ragData = await aiResponse.json();
        return res.status(200).json({
          success: true,
          data: {
            query,
            retrievedGuideline: {
              title: ragData.citations?.[0] || 'Indexed Clinical Medical Reference',
              organization: 'WHO / ICMR / DCMC Specialty Guidelines',
              summary: ragData.answer,
              keyPoints: ragData.citations || [],
            },
            citations: ragData.citations || [],
            workflow_trace: ragData.workflow_trace || [],
            top3_sources: ragData.top3_sources || [],
            is_self_rag: true,
          },
        });
      }
    } catch (e) {
      console.log('[Knowledge Controller] Self-RAG service call bypassed, using clinical guideline store:', e.message);
    }

    // 2. Fallback to local clinical guideline store
    const answerData = queryClinicalRAG(query);
    return res.status(200).json({
      success: true,
      data: answerData,
    });
  } catch (error) {
    console.error('[Ask Medical RAG Error]', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to retrieve grounded medical guidelines.' },
    });
  }
};

export const checkMisinformation = async (req, res) => {
  try {
    const { claim } = req.body;
    if (!claim || !claim.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Health claim or statement is required for verification.' },
      });
    }

    const verdictData = checkMedicalMyth(claim);
    return res.status(200).json({
      success: true,
      data: verdictData,
    });
  } catch (error) {
    console.error('[Check Misinformation Error]', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to verify health claim.' },
    });
  }
};

export const detectDeficiency = async (req, res) => {
  try {
    const { symptoms } = req.body;
    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'An array of reported physical symptoms is required.' },
      });
    }

    const result = detectNutritionalDeficiency(symptoms);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[Detect Deficiency Error]', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Failed to evaluate nutritional deficiencies.' },
    });
  }
};
