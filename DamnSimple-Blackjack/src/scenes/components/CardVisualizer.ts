// src/scenes/components/cardvisualizer-ts (Modified for flat cards)
import { Scene, Vector3, MeshBuilder, StandardMaterial, Color3, Texture,
    Mesh, Animation, DynamicTexture, EasingFunction, CubicEase, QuadraticEase, AnimationEvent, Vector2 } from "@babylonjs/core";
import { Card, Suit, Rank } from "../../game/Card";
import { BlackjackGame } from "../../game/BlackjackGame";

export class CardVisualizer {
    private scene: Scene;
    private blackjackGame: BlackjackGame;
    private cardMeshes: Map<string, Mesh> = new Map();
    private deckPosition: Vector3;
    private animationInProgress: boolean = false;
    private onAnimationCompleteCallback: (() => void) | null = null;

    private static readonly CARD_WIDTH = 1.0;
    private static readonly CARD_HEIGHT = 1.4;
    private static readonly CARD_SPACING = 1.2;
    // Adjust Y position for flat cards
    private static readonly CARD_Y_POS = 0.05; // Slightly above table surface
    private static readonly DECK_Y_POS = 0.01; // Slightly below cards

    private static readonly DEAL_DURATION_MS = 400;
    private static readonly REPOSITION_DURATION_MS = 300;
    private static readonly FLIP_DURATION_MS = 300;
    private static readonly FPS = 60;

    private materialCache: Map<string, StandardMaterial> = new Map();
    private cardBackMaterial: StandardMaterial | null = null;

    constructor(scene: Scene, blackjackGame: BlackjackGame, deckPosition: Vector3) {
        this.scene = scene;
        this.blackjackGame = blackjackGame;
        // Adjust deck position Y
        this.deckPosition = deckPosition.clone();
        this.deckPosition.y = CardVisualizer.DECK_Y_POS; // Use static Y pos

        this.blackjackGame.addCardFlipCallback(
             "cardVisualizerFlipHandler",
             (card) => {
                console.log(`CardVisualizer received flip notification for ${card.toString()}`);
                this.updateCardVisual(card);
             }
        );
    }

    public setOnAnimationCompleteCallback(callback: () => void): void {
        this.onAnimationCompleteCallback = callback;
    }

    // *** ADDED Getter for back material ***
    public getCardBackMaterial(): StandardMaterial | null {
        if (!this.cardBackMaterial) {
            // Create it if it doesn't exist yet
            // Need a dummy card to create material
            const dummyCard = new Card(Suit.Spades, Rank.Ace); // Suit/Rank don't matter for back
            this.createCardMaterial(dummyCard, false);
        }
        return this.cardBackMaterial;
    }


    public createCardMesh(card: Card, index: number, isPlayer: boolean, faceUp: boolean): void {
        const cardId = card.getUniqueId();
        if (this.cardMeshes.has(cardId)) {
            console.warn(`Card mesh already exists for ${card.toString()}. Repositioning instead.`);
            this.repositionCard(card, index, isPlayer);
            return;
        }
        console.log(`Creating card mesh for ${card.toString()} (faceUp=${faceUp}) at index ${index}, isPlayer=${isPlayer}`);
        const cardMesh = MeshBuilder.CreatePlane(
            `card_${cardId}`,
            { width: CardVisualizer.CARD_WIDTH, height: CardVisualizer.CARD_HEIGHT, sideOrientation: Mesh.DOUBLESIDE },
            this.scene
        );
        cardMesh.position = this.deckPosition.clone(); // Start at deck position
        // *** Rotate card to be flat (on XZ plane) and initially face down ***
        cardMesh.rotation = new Vector3(Math.PI / 2, 0, Math.PI);
        cardMesh.material = this.createCardMaterial(card, false); // Start with back material
        this.cardMeshes.set(cardId, cardMesh);

        const finalPosition = this.calculateCardPosition(index, isPlayer, this.getHandSize(isPlayer));
        // *** Final rotation around Z-axis for flat cards ***
        const finalRotationZ = faceUp ? 0 : Math.PI;
        this.animateCardDealing(cardMesh, finalPosition, finalRotationZ, faceUp, card);
    }

    private getHandSize(isPlayer: boolean): number {
        return isPlayer ? this.blackjackGame.getPlayerHand().length : this.blackjackGame.getDealerHand().length;
    }

    public renderCards(isRestoring: boolean = false): void {
        console.log(`Rendering cards... isRestoring: ${isRestoring}`);
        const playerHand = this.blackjackGame.getPlayerHand();
        const dealerHand = this.blackjackGame.getDealerHand();
        const allHands = [{ hand: playerHand, isPlayer: true }, { hand: dealerHand, isPlayer: false }];

        allHands.forEach(({ hand, isPlayer }) => {
            if (!isRestoring) this.repositionCards(isPlayer, hand);
            hand.forEach((card, index) => {
                const cardId = card.getUniqueId();
                if (!this.cardMeshes.has(cardId)) {
                    if (isRestoring) this.createCardMeshInstant(card, index, isPlayer);
                    else console.warn(`renderCards creating missing card: ${card.toString()}. Should be created on deal.`);
                } else if (isRestoring) {
                     this.updateCardVisual(card, true); // Update visual instantly on restore
                 }
            });
        });

         const currentCardIds = new Set([...playerHand, ...dealerHand].map(c => c.getUniqueId()));
         this.cardMeshes.forEach((mesh, cardId) => {
             if (!currentCardIds.has(cardId)) {
                 console.log(`Disposing stale card mesh: ${mesh.name}`);
                 mesh.dispose();
                 this.cardMeshes.delete(cardId);
             }
         });
        console.log(`Render complete. Total meshes: ${this.cardMeshes.size}`);
    }

     private createCardMeshInstant(card: Card, index: number, isPlayer: boolean): void {
        const cardId = card.getUniqueId();
         console.log(`Creating card mesh INSTANTLY for ${card.toString()} (faceUp=${card.isFaceUp()})`);
        const cardMesh = MeshBuilder.CreatePlane(
            `card_${cardId}`,
            { width: CardVisualizer.CARD_WIDTH, height: CardVisualizer.CARD_HEIGHT, sideOrientation: Mesh.DOUBLESIDE },
            this.scene
        );
        const position = this.calculateCardPosition(index, isPlayer, this.getHandSize(isPlayer));
        // *** Rotate card to be flat (on XZ plane) ***
        const rotationZ = card.isFaceUp() ? 0 : Math.PI;
        cardMesh.position = position;
        cardMesh.rotation = new Vector3(Math.PI / 2, 0, rotationZ); // Set X and Z rotation
        cardMesh.material = this.createCardMaterial(card, card.isFaceUp());
        this.cardMeshes.set(cardId, cardMesh);
    }

    private repositionCards(isPlayer: boolean, hand: Card[]): void {
        const handSize = hand.length;
        hand.forEach((card, index) => {
            const cardId = card.getUniqueId();
            const cardMesh = this.cardMeshes.get(cardId);
            if (cardMesh) {
                const newPosition = this.calculateCardPosition(index, isPlayer, handSize);
                if (!cardMesh.position.equalsWithEpsilon(newPosition, 0.01)) {
                    // Use existing animation function
                    this.animateVector3(cardMesh, "position", newPosition, CardVisualizer.REPOSITION_DURATION_MS, new QuadraticEase());
                }
            }
        });
    }

     private repositionCard(card: Card, index: number, isPlayer: boolean): void {
         const cardId = card.getUniqueId();
         const cardMesh = this.cardMeshes.get(cardId);
         const handSize = this.getHandSize(isPlayer);
         if (cardMesh) {
             const newPosition = this.calculateCardPosition(index, isPlayer, handSize);
             if (!cardMesh.position.equalsWithEpsilon(newPosition, 0.01)) {
                 this.animateVector3(cardMesh, "position", newPosition, CardVisualizer.REPOSITION_DURATION_MS, new QuadraticEase());
             }
         }
     }

    public updateCardVisual(card: Card, forceImmediate: boolean = false): void {
        const cardId = card.getUniqueId();
        const cardMesh = this.cardMeshes.get(cardId);
        if (!cardMesh) { console.warn(`Cannot update visual for card ${card.toString()}, mesh not found.`); return; }
        console.log(`Updating visual for ${card.toString()} to faceUp=${card.isFaceUp()}, forceImmediate=${forceImmediate}`);
        // *** Target rotation around Z-axis ***
        const targetRotationZ = card.isFaceUp() ? 0 : Math.PI;

        if (forceImmediate || Math.abs(cardMesh.rotation.z - targetRotationZ) < 0.01) {
            // Apply instantly if forced or already close
            cardMesh.material = this.createCardMaterial(card, card.isFaceUp());
            cardMesh.rotation.z = targetRotationZ; // Ensure exact final rotation
        } else {
             // Animate the flip around Z-axis
             this.animateFlip(cardMesh, card.isFaceUp(), card);
        }
    }

    public clearTable(): void {
        console.log("Clearing table visuals...");
        this.animationInProgress = false; // Reset flag
        // Stop any ongoing animations associated with the meshes being disposed
        this.cardMeshes.forEach(mesh => this.scene.stopAnimation(mesh));
        this.cardMeshes.forEach(mesh => mesh.dispose());
        this.cardMeshes.clear();
    }

    public isAnimationInProgress(): boolean { return this.animationInProgress; }

    // --- Animations ---
    // *** Modified to animate rotation.z ***
    private animateCardDealing(mesh: Mesh, targetPos: Vector3, targetRotZ: number, faceUp: boolean, card: Card): void {
        this.animationInProgress = true;
        const durationFrames = CardVisualizer.DEAL_DURATION_MS / 1000 * CardVisualizer.FPS;
        const easing = new CubicEase();
        easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

        // Position Animation (unchanged)
        const posAnim = new Animation("dealPosAnim", "position", CardVisualizer.FPS, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
        posAnim.setKeys([{ frame: 0, value: mesh.position.clone() }, { frame: durationFrames, value: targetPos }]);
        posAnim.setEasingFunction(easing);

        // Rotation Animation (around Z-axis)
        const rotAnim = new Animation("dealRotAnim", "rotation.z", CardVisualizer.FPS, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        rotAnim.setKeys([{ frame: 0, value: mesh.rotation.z }, { frame: durationFrames, value: targetRotZ }]);
        rotAnim.setEasingFunction(easing);

         // Update material mid-animation if flipping face up during deal
         if (faceUp && mesh.rotation.z !== targetRotZ) { // Check if rotation actually changes
             const materialUpdateEvent = new AnimationEvent(durationFrames / 2, () => {
                 console.log(`Updating material mid-deal for ${card.toString()}`);
                 mesh.material = this.createCardMaterial(card, true);
             }, true); // Only once
             rotAnim.addEvent(materialUpdateEvent);
         }

        // Start animation
        this.scene.beginDirectAnimation(mesh, [posAnim, rotAnim], 0, durationFrames, false, 1, 
            () => {
                this.animationInProgress = false;
                console.log(`Deal complete for ${card.toString()}`);
                
                // Immediately process next animation
                if (this.onAnimationCompleteCallback) {
                    this.onAnimationCompleteCallback();
                }
            }
        );
    }

     // *** Modified to animate rotation.z ***
     private animateFlip(mesh: Mesh, faceUp: boolean, card: Card): void {
        this.animationInProgress = true;
        const durationFrames = CardVisualizer.FLIP_DURATION_MS / 1000 * CardVisualizer.FPS;
        const easing = new QuadraticEase(); easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

        const startRotationZ = mesh.rotation.z;
        const targetRotationZ = faceUp ? 0 : Math.PI;
        console.log(`Starting flip animation for ${mesh.name} from rotZ ${startRotationZ} to ${targetRotationZ}`);

        // Rotation Animation (around Z-axis)
        const rotAnim = new Animation("flipRotAnim", "rotation.z", CardVisualizer.FPS, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        rotAnim.setKeys([{ frame: 0, value: startRotationZ }, { frame: durationFrames, value: targetRotationZ }]);
        rotAnim.setEasingFunction(easing);

        // Material update event at halfway point
        const materialUpdateEvent = new AnimationEvent(durationFrames / 2, () => {
            console.log(`Updating material mid-flip for ${card.toString()}`);
            mesh.material = this.createCardMaterial(card, faceUp);
        }, true); // Only once
        rotAnim.addEvent(materialUpdateEvent);

        // Start animation
        this.scene.beginDirectAnimation(mesh, [rotAnim], 0, durationFrames, false, 1, () => {
            this.animationInProgress = false;
            mesh.rotation.z = targetRotationZ; // Ensure exact final rotation
            console.log(`Flip animation complete for ${mesh.name}`);
            if (this.onAnimationCompleteCallback) this.onAnimationCompleteCallback();
        });
    }

    private animateVector3(mesh: Mesh, property: string, targetValue: Vector3, durationMs: number, easing?: EasingFunction): void {
        this.animationInProgress = true;
        const durationFrames = durationMs / 1000 * CardVisualizer.FPS;
        const effectiveEasing = easing ?? new CubicEase();
        if (!easing) effectiveEasing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

        const anim = new Animation(`${property}Anim_${mesh.name}`, property, CardVisualizer.FPS, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);

        // *** FIX: Check property before cloning ***
        let startValue: Vector3;
        if (property === 'position') {
            startValue = mesh.position.clone();
        } else if (property === 'rotation') {
             // Note: We are animating rotation.z separately now, so this might not be used for rotation
            startValue = mesh.rotation.clone();
        } else {
            startValue = Vector3.Zero(); // Default or throw error
            console.error(`animateVector3 called with unsupported property: ${property}`);
            this.animationInProgress = false;
            return;
        }

        anim.setKeys([{ frame: 0, value: startValue }, { frame: durationFrames, value: targetValue }]);
        anim.setEasingFunction(effectiveEasing);

        this.scene.beginDirectAnimation(mesh, [anim], 0, durationFrames, false, 1, () => {
            // Ensure final value is set precisely
            if (property === 'position') mesh.position = targetValue;
            else if (property === 'rotation') mesh.rotation = targetValue;

            this.animationInProgress = false;
            // Check if other animations might still be running before calling the global callback?
            // For simplicity, assume this is the only animation or the last one for now.
            if (this.onAnimationCompleteCallback) this.onAnimationCompleteCallback();
        });
    }

    // *** Modified to use CARD_Y_POS ***
    private calculateCardPosition(index: number, isPlayer: boolean, handSize: number): Vector3 {
        // Z position determines player (positive Z) or dealer (negative Z)
        const zPos = isPlayer ? 2.5 : -2.5;
        // Use the static Y position for flat cards
        const yPos = CardVisualizer.CARD_Y_POS;
        // Calculate X position based on index and spacing
        const totalWidth = (handSize - 1) * CardVisualizer.CARD_SPACING; // Width occupied by cards
        const startX = -(totalWidth / 2); // Start from the left edge
        const xPos = startX + (index * CardVisualizer.CARD_SPACING);

        return new Vector3(xPos, yPos, zPos);
    }

    // --- Material Creation ---
    // (No changes needed here for rotation, but ensure back material caching works)
    private createCardMaterial(card: Card, faceUp: boolean): StandardMaterial {
        const cacheKey = faceUp ? `${card.getSuit()}-${card.getRank()}` : "cardBack";

        // Return cached material if available
        if (this.materialCache.has(cacheKey)) return this.materialCache.get(cacheKey)!;
        // Special check for card back material instance
        if (!faceUp && this.cardBackMaterial) return this.cardBackMaterial;

        console.log(`Creating material: ${cacheKey}`);
        const textureSize = { width: 256, height: 358 }; // Aspect ratio approx sqrt(2)
        const texture = new DynamicTexture(`texture_${cacheKey}`, textureSize, this.scene, true);
        const ctx = texture.getContext() as CanvasRenderingContext2D; // Already fixed
        ctx.imageSmoothingEnabled = true; // Keep smoothing

        // Background color
        ctx.fillStyle = faceUp ? "#FEFEFE" : "#B22222"; // White for face, Red for back
        ctx.fillRect(0, 0, textureSize.width, textureSize.height);

        // Border
        const borderWidth = 8;
        ctx.strokeStyle = "#000000"; // Black border
        ctx.lineWidth = borderWidth / 2; // Adjust line width if needed
        ctx.strokeRect(borderWidth / 2, borderWidth / 2, textureSize.width - borderWidth, textureSize.height - borderWidth);

        if (faceUp) {
            // --- Draw Card Face ---
            const suit = card.getSuit();
            const rank = card.getRank();
            const color = (suit === Suit.Hearts || suit === Suit.Diamonds) ? "#FF0000" : "#000000"; // Red or Black
            const suitSymbols = { Hearts: "♥", Diamonds: "♦", Clubs: "♣", Spades: "♠" };
            const symbol = suitSymbols[suit];

            // Font sizes
            const rankFontSize = 48;
            const suitFontSize = 40;
            const cornerRankFontSize = 24;
            const cornerSuitFontSize = 20;

            // Center Rank
            ctx.font = `bold ${rankFontSize}px Arial`;
            ctx.fillStyle = color;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(rank, textureSize.width / 2, textureSize.height * 0.3); // Position rank

            // Center Suit Symbol
            ctx.font = `bold ${suitFontSize}px Arial`;
            ctx.fillText(symbol, textureSize.width / 2, textureSize.height * 0.65); // Position suit

            // Top-Left Corner
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.font = `bold ${cornerRankFontSize}px Arial`;
            ctx.fillText(rank, 15, 10); // Rank
            ctx.font = `bold ${cornerSuitFontSize}px Arial`;
            ctx.fillText(symbol, 15, 10 + cornerRankFontSize + 2); // Suit below rank

            // Bottom-Right Corner (Rotated)
            ctx.save(); // Save context state
            ctx.textAlign = "right"; // Align to the right before rotation
            ctx.textBaseline = "bottom"; // Align to the bottom before rotation
            // Translate origin to bottom-right corner (adjusting for padding)
            ctx.translate(textureSize.width - 15, textureSize.height - 10);
            ctx.rotate(Math.PI); // Rotate 180 degrees
            // Draw relative to the new (0,0) which is the bottom-right corner
            ctx.font = `bold ${cornerRankFontSize}px Arial`;
            ctx.fillText(rank, 0, 0); // Rank at new origin
            ctx.font = `bold ${cornerSuitFontSize}px Arial`;
            ctx.fillText(symbol, 0, -(cornerRankFontSize + 2)); // Suit above rank (negative Y due to rotation)
            ctx.restore(); // Restore context state

        } else {
            // --- Draw Card Back ---
            // Simple pattern (e.g., diagonal lines or a logo)
            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"; // Lighter pattern color
            ctx.lineWidth = 4;
            const spacing = 20;
            for (let i = -textureSize.height; i < textureSize.width; i += spacing) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i + textureSize.height, textureSize.height);
                ctx.stroke();
            }
            // Add a central design element maybe?
            ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
            ctx.beginPath();
            ctx.arc(textureSize.width / 2, textureSize.height / 2, 50, 0, Math.PI * 2);
            ctx.fill();
        }

        texture.update(false); // Update the texture mipmaps

        // --- Create Material ---
        const material = new StandardMaterial(`material_${cacheKey}`, this.scene);
        material.diffuseTexture = texture;
        material.specularColor = new Color3(0.1, 0.1, 0.1); // Reduce shininess
        material.backFaceCulling = false; // Important for single plane
        material.emissiveColor = new Color3(0.1, 0.1, 0.1); // Slight self-illumination

        // Cache the material
        this.materialCache.set(cacheKey, material);

        // Store the specific card back material instance
        if (!faceUp) {
            this.cardBackMaterial = material;
        }

        return material;
    }
}
