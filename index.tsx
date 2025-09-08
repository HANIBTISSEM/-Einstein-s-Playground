import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type } from "@google/genai";

interface Scene {
  narration: string;
  imageUrl: string | null;
  isLoadingImage: boolean;
}

const App = () => {
  const [storyboard, setStoryboard] = useState<Scene[]>([]);
  const [concept, setConcept] = useState("");
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

  const generateStoryboard = async () => {
    if (concept.trim() === "") {
        setError("Please enter a concept to explain.");
        return;
    }
    setIsLoading(true);
    setError(null);
    setStoryboard([]);
    setCurrentSceneIndex(0);

    try {
      // Step 1: Generate the narration for all scenes
      const narrationPrompt = `
        You are an AI storyteller for 6-year-olds.
        Explain the concept "${concept}".
        Create a storyboard with 5 scenes.
        For each scene, provide a short narration (2-3 simple sentences).
      `;

      const narrationResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: narrationPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                scene: { type: Type.INTEGER },
                narration: { type: Type.STRING },
              },
            },
          },
        },
      });

      const parsedScenes = JSON.parse(narrationResponse.text);
      const initialStoryboard: Scene[] = parsedScenes.map((s: any) => ({
        narration: s.narration,
        imageUrl: null,
        isLoadingImage: true,
      }));
      setStoryboard(initialStoryboard);

      // Step 2: Generate images for each scene sequentially
      let currentStoryboard = [...initialStoryboard];
      for (let i = 0; i < initialStoryboard.length; i++) {
        const scene = initialStoryboard[i];
        const imagePrompt = `
          A cute, small robot character named Glitch with a single glowing purple eye.
          Scene: ${scene.narration}.
          Style: 16-bit pixel art, dark cyberpunk style with neon accents (purple, blue, pink), consistent proportions, clear outlines.
        `;

        try {
            const imageResponse = await ai.models.generateImages({
              model: 'imagen-4.0-generate-001',
              prompt: imagePrompt,
              config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1',
              },
            });

            const base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
            const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;

            currentStoryboard = currentStoryboard.map((s, index) =>
              index === i ? { ...s, imageUrl, isLoadingImage: false } : s
            );
            setStoryboard(currentStoryboard);
        } catch (imageError) {
             console.error(`Error generating image for scene ${i + 1}:`, imageError);
             // Still update the state to stop loading for this failed image
             currentStoryboard = currentStoryboard.map((s, index) =>
              index === i ? { ...s, isLoadingImage: false, imageUrl: null } : s // Mark as not loading, no image
            );
            setStoryboard(currentStoryboard);
        }
      }
    } catch (e) {
      console.error(e);
      setError("Failed to generate the storyboard. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrev = () => {
    setCurrentSceneIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = () => {
    setCurrentSceneIndex((prev) => Math.min(prev + 1, storyboard.length - 1));
  };
  
  const currentScene = storyboard[currentSceneIndex];

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">AI Storyteller</h1>
        <p className="subtitle">Explaining big ideas with small stories.</p>
      </header>

      {storyboard.length === 0 && !isLoading && (
        <>
            <div className="form-group">
                <label htmlFor="concept-input" className="form-label">
                    What concept should I explain?
                </label>
                <input 
                    type="text" 
                    id="concept-input"
                    className="input-field"
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="e.g., How rockets work"
                    aria-required="true"
                />
            </div>
            <button
              className="button"
              onClick={generateStoryboard}
              disabled={isLoading || concept.trim() === ''}
              aria-label="Generate a new storyboard"
            >
              Tell me a Story
            </button>
        </>
      )}

      {isLoading && storyboard.length === 0 && <div className="loader" role="status" aria-label="Loading storyboard text"></div>}
      
      {error && <div className="error-message">{error}</div>}

      {storyboard.length > 0 && currentScene && (
        <div className="storyboard">
            <div key={currentSceneIndex} className="scene" aria-live="polite">
              <div className="image-container">
                {currentScene.isLoadingImage && (
                  <div className="image-loader" role="status" aria-label={`Loading image for scene ${currentSceneIndex + 1}`}></div>
                )}
                {!currentScene.isLoadingImage && currentScene.imageUrl && (
                  <img
                    src={currentScene.imageUrl}
                    alt={`Illustration for: ${currentScene.narration}`}
                    className="scene-image"
                  />
                )}
                 {!currentScene.isLoadingImage && !currentScene.imageUrl && (
                  <p>Image could not be loaded.</p>
                )}
              </div>
              <p className="narration">{currentScene.narration}</p>
            </div>

            <div className="carousel-nav">
                <button className="button nav-button" onClick={handlePrev} disabled={currentSceneIndex === 0}>
                    Prev
                </button>
                <span className="scene-counter" aria-label={`Scene ${currentSceneIndex + 1} of ${storyboard.length}`}>
                    {currentSceneIndex + 1} / {storyboard.length}
                </span>
                <button className="button nav-button" onClick={handleNext} disabled={currentSceneIndex === storyboard.length - 1}>
                    Next
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<App />);