// src/scenes/components/cardvisualizer-ts (Uses animation callback, Map for meshes)
import { Scene, Vector3, MeshBuilder, StandardMaterial, Color3, Texture,
    Mesh, Animation, DynamicTexture, EasingFunction, CubicEase, QuadraticEase, AnimationEvent } from "@babylonjs/core";
import { Card, Suit, Rank } from "../../game/Card";
import { BlackjackGame } from "../../game/BlackjackGame";
import { GameState } from "../../game/GameState";

export class CardVisualizer {
    private scene: Scene;
    private blackjackGame: BlackjackGame;
    // Use card's uniqueId as key for reliability
    private cardMeshes: Map<string, Mesh> = new Map();
    private deckPosition: Vector3;
    private animationInProgress: boolean = false;
    private onAnimationCompleteCallback: (() => void) | null = null;

    // Card dimensions
    private static readonly CARD_WIDTH = 1.0;
    private static readonly CARD_HEIGHT = 1.4;
    private static readonly CARD_SPACING = 1.2; // Width + gap

    // Animation parameters
    private static readonly DEAL_DURATION_MS = 400; // Faster deal
    private static readonly REPOSITION_DURATION_MS = 300;
    private static readonly FLIP_DURATION_MS = 300;
    private static readonly FPS = 60;


    constructor(scene: Scene, blackjackGame: BlackjackGame, deckPosition: Vector3) {
        this.scene = scene;
        this.blackjackGame = blackjackGame;
        this.deckPosition = deckPosition;

        // Register callback for card flips (visual update)
        // Use a unique ID for this visualizer's callback
        this.blackjackGame.getHandManager().addCardFlipCallback(
             "cardVisualizerFlipHandler", // Unique ID
             (card) => {
                console.log(`CardVisualizer received flip notification for ${card.toString()}`);
                this.updateCardVisual(card);
             }
        );
    }

    /**
     * Sets the callback function to be invoked when a visual animation completes.
     * @param callback The function to call on animation completion.
     */
     public setOnAnimationCompleteCallback(callback: () => void): void {
        this.onAnimationCompleteCallback = callback;
    }

    /**
     * Creates a visual mesh for a card, deals it face down initially,
     * then animates it to its position and flips it if needed.
     */
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

        // Initial state: At deck, face down visually (material will be updated later if needed)
        cardMesh.position = this.deckPosition.clone();
        cardMesh.rotation = new Vector3(0, Math.PI, 0); // Start face down (assuming back texture is default)
        cardMesh.material = this.createCardMaterial(card, false); // Create face-down material initially

        // Store mesh immediately
        this.cardMeshes.set(cardId, cardMesh);

        // Calculate final position
        const finalPosition = this.calculateCardPosition(index, isPlayer, this.getHandSize(isPlayer));
        const finalRotation = new Vector3(0, faceUp ? 0 : Math.PI, 0); // Target rotation based on faceUp

        // Animate dealing (position and rotation)
        this.animateCardDealing(cardMesh, finalPosition, finalRotation, faceUp, card);
    }

    /** Helper to get current hand size */
    private getHandSize(isPlayer: boolean): number {
        return isPlayer ? this.blackjackGame.getPlayerHand().length : this.blackjackGame.getDealerHand().length;
    }

    /**
     * Renders cards based on the current game state.
     * If restoring, creates all cards without animation.
     * Otherwise, finds missing cards and creates/animates them.
     * @param isRestoring - If true, creates cards instantly at final positions.
     */
    public renderCards(isRestoring: boolean = false): void {
        console.log(`Rendering cards... isRestoring: ${isRestoring}`);
        const playerHand = this.blackjackGame.getPlayerHand();
        const dealerHand = this.blackjackGame.getDealerHand();

        const allHands = [
            { hand: playerHand, isPlayer: true },
            { hand: dealerHand, isPlayer: false }
        ];

        let createdNewCards = false;

        allHands.forEach(({ hand, isPlayer }) => {
            // Reposition existing cards first if not restoring
            if (!isRestoring) {
                 this.repositionCards(isPlayer, hand);
            }

            // Create missing cards
            hand.forEach((card, index) => {
                const cardId = card.getUniqueId();
                if (!this.cardMeshes.has(cardId)) {
                    createdNewCards = true;
                    if (isRestoring) {
                        // Create instantly at final position
                        this.createCardMeshInstant(card, index, isPlayer);
                    } else {
                        // This path should ideally not be hit often if createCardMesh is called correctly on deal
                        console.warn(`renderCards creating missing card: ${card.toString()}. Should be created on deal.`);
                        // Create with animation (will be triggered by game logic via notifyCardDealt)
                        // this.createCardMesh(card, index, isPlayer, card.isFaceUp());
                    }
                }
                 // Ensure existing card visuals match logical state (especially for restore)
                 else if (isRestoring) {
                     this.updateCardVisual(card, true); // Force update material/rotation on restore
                 }
            });
        });

         // Clean up meshes for cards no longer in hands (e.g., after reset)
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

     /** Creates card instantly at final position/rotation. Used for restore. */
     private createCardMeshInstant(card: Card, index: number, isPlayer: boolean): void {
        const cardId = card.getUniqueId();
         console.log(`Creating card mesh INSTANTLY for ${card.toString()} (faceUp=${card.isFaceUp()})`);

        const cardMesh = MeshBuilder.CreatePlane(
            `card_${cardId}`,
            { width: CardVisualizer.CARD_WIDTH, height: CardVisualizer.CARD_HEIGHT, sideOrientation: Mesh.DOUBLESIDE },
            this.scene
        );

        const position = this.calculateCardPosition(index, isPlayer, this.getHandSize(isPlayer));
        const rotation = new Vector3(0, card.isFaceUp() ? 0 : Math.PI, 0);

        cardMesh.position = position;
        cardMesh.rotation = rotation;
        cardMesh.material = this.createCardMaterial(card, card.isFaceUp()); // Create correct material

        this.cardMeshes.set(cardId, cardMesh);
    }


    /** Repositions cards in a hand smoothly */
    private repositionCards(isPlayer: boolean, hand: Card[]): void {
        const handSize = hand.length;
        hand.forEach((card, index) => {
            const cardId = card.getUniqueId();
            const cardMesh = this.cardMeshes.get(cardId);
            if (cardMesh) {
                const newPosition = this.calculateCardPosition(index, isPlayer, handSize);
                // Only animate if position actually changes significantly
                if (!cardMesh.position.equalsWithEpsilon(newPosition, 0.01)) {
                    // console.log(`Repositioning ${card.toString()} to ${newPosition}`);
                    this.animateVector3(
                        cardMesh,
                        "position",
                        newPosition,
                        CardVisualizer.REPOSITION_DURATION_MS,
                        new QuadraticEase() // Use a different ease for reposition
                    );
                }
            }
        });
    }

     /** Repositions a single card */
     private repositionCard(card: Card, index: number, isPlayer: boolean): void {
         const cardId = card.getUniqueId();
         const cardMesh = this.cardMeshes.get(cardId);
         const handSize = this.getHandSize(isPlayer);
         if (cardMesh) {
             const newPosition = this.calculateCardPosition(index, isPlayer, handSize);
             if (!cardMesh.position.equalsWithEpsilon(newPosition, 0.01)) {
                 this.animateVector3(
                     cardMesh,
                     "position",
                     newPosition,
                     CardVisualizer.REPOSITION_DURATION_MS,
                     new QuadraticEase()
                 );
             }
         }
     }


    /** Updates the visual (material, rotation) of a card, optionally animating the flip */
    public updateCardVisual(card: Card, forceImmediate: boolean = false): void {
        const cardId = card.getUniqueId();
        const cardMesh = this.cardMeshes.get(cardId);
        if (!cardMesh) {
             console.warn(`Cannot update visual for card ${card.toString()}, mesh not found.`);
             return;
        }

        console.log(`Updating visual for ${card.toString()} to faceUp=${card.isFaceUp()}, forceImmediate=${forceImmediate}`);

        const targetRotationY = card.isFaceUp() ? 0 : Math.PI;

        if (forceImmediate || Math.abs(cardMesh.rotation.y - targetRotationY) < 0.01) {
            // If immediate or already correct, just set material and rotation directly
            cardMesh.material = this.createCardMaterial(card, card.isFaceUp());
            cardMesh.rotation.y = targetRotationY;
        } else {
             // Animate the flip (Y-axis rotation)
             this.animateFlip(cardMesh, card.isFaceUp(), card);
        }
    }

    /** Clears all card meshes from the scene */
    public clearTable(): void {
        console.log("Clearing table visuals...");
        this.animationInProgress = false; // Stop tracking animations
        this.cardMeshes.forEach(mesh => mesh.dispose());
        this.cardMeshes.clear();
    }

    public isAnimationInProgress(): boolean {
        return this.animationInProgress;
    }

    // --- Private Animation Helpers ---

    /** Animates dealing: position and rotation */
    private animateCardDealing(mesh: Mesh, targetPos: Vector3, targetRot: Vector3, faceUp: boolean, card: Card): void {
        this.animationInProgress = true;
        const durationFrames = CardVisualizer.DEAL_DURATION_MS / 1000 * CardVisualizer.FPS;
        const easing = new CubicEase();
        easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

        // Position Animation
        const posAnim = new Animation("dealPosAnim", "position", CardVisualizer.FPS, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
        posAnim.setKeys([
            { frame: 0, value: mesh.position.clone() },
            { frame: durationFrames, value: targetPos }
        ]);
        posAnim.setEasingFunction(easing);

        // Rotation Animation (Y-axis only for flip)
        const rotAnim = new Animation("dealRotAnim", "rotation.y", CardVisualizer.FPS, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        rotAnim.setKeys([
            { frame: 0, value: mesh.rotation.y },
            { frame: durationFrames, value: targetRot.y } // Target Y rotation
        ]);
        rotAnim.setEasingFunction(easing);

         // Update material halfway through rotation if flipping face up
         if (faceUp && mesh.rotation.y !== targetRot.y) {
             const materialUpdateEvent = new AnimationEvent(
                 durationFrames / 2, // Halfway point
                 () => {
                     console.log(`Updating material mid-deal for ${card.toString()}`);
                     mesh.material = this.createCardMaterial(card, true);
                 },
                 true // onlyOnce
             );
             rotAnim.addEvent(materialUpdateEvent);
         }


        // Run animations
        this.scene.beginDirectAnimation(mesh, [posAnim, rotAnim], 0, durationFrames, false, 1, () => {
            this.animationInProgress = false;
            console.log(`Deal animation complete for ${mesh.name}`);
            if (this.onAnimationCompleteCallback) {
                this.onAnimationCompleteCallback();
            }
        });
    }

     /** Animates flip: Y-axis rotation with material change halfway */
     private animateFlip(mesh: Mesh, faceUp: boolean, card: Card): void {
        this.animationInProgress = true;
        const durationFrames = CardVisualizer.FLIP_DURATION_MS / 1000 * CardVisualizer.FPS;
        const easing = new QuadraticEase(); // Different ease for flip
        easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

        const startRotationY = mesh.rotation.y;
        const targetRotationY = faceUp ? 0 : Math.PI;

        const rotAnim = new Animation("flipRotAnim", "rotation.y", CardVisualizer.FPS, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        rotAnim.setKeys([
            { frame: 0, value: startRotationY },
            { frame: durationFrames, value: targetRotationY }
        ]);
        rotAnim.setEasingFunction(easing);

        // Event to change material halfway through the flip
        const materialUpdateEvent = new AnimationEvent(
            durationFrames / 2,
            () => {
                console.log(`Updating material mid-flip for ${card.toString()}`);
                mesh.material = this.createCardMaterial(card, faceUp);
            },
            true // onlyOnce
        );
        rotAnim.addEvent(materialUpdateEvent);

        // Run animation
        this.scene.beginDirectAnimation(mesh, [rotAnim], 0, durationFrames, false, 1, () => {
            this.animationInProgress = false;
            console.log(`Flip animation complete for ${mesh.name}`);
            // Ensure final rotation is exact
            mesh.rotation.y = targetRotationY;
            if (this.onAnimationCompleteCallback) {
                this.onAnimationCompleteCallback();
            }
        });
    }


    /** Generic animation for Vector3 properties */
    private animateVector3(mesh: Mesh, property: string, targetValue: Vector3, durationMs: number, easing?: EasingFunction): void {
        this.animationInProgress = true;
        const durationFrames = durationMs / 1000 * CardVisualizer.FPS;
        const effectiveEasing = easing ?? new CubicEase();
        if (!easing) effectiveEasing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

        const anim = new Animation(
            `${property}Anim_${mesh.name}`,
            property,
            CardVisualizer.FPS,
            Animation.ANIMATIONTYPE_VECTOR3,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        anim.setKeys([
            { frame: 0, value: mesh.position.clone() }, // Assumes property is position for clone, adjust if needed
            { frame: durationFrames, value: targetValue }
        ]);
        anim.setEasingFunction(effectiveEasing);

        this.scene.beginDirectAnimation(mesh, [anim], 0, durationFrames, false, 1, () => {
            this.animationInProgress = false;
             // console.log(`${property} animation complete for ${mesh.name}`);
            if (this.onAnimationCompleteCallback) {
                this.onAnimationCompleteCallback();
            }
        });
    }


    /** Calculates card position */
    private calculateCardPosition(index: number, isPlayer: boolean, handSize: number): Vector3 {
        const zPos = isPlayer ? 2.5 : -2.5; // Adjusted Z positions
        const yPos = 0.15; // Slightly above table

        const totalWidth = handSize * CardVisualizer.CARD_SPACING;
        // Start X calculation: -(TotalWidth / 2) + (CardSpacing / 2)
        const startX = -(totalWidth / 2) + (CardVisualizer.CARD_SPACING / 2);
        const xPos = startX + (index * CardVisualizer.CARD_SPACING);

        return new Vector3(xPos, yPos, zPos);
    }

    // --- Card Material Creation ---
    // Cache materials to avoid recreating textures constantly
    private materialCache: Map<string, StandardMaterial> = new Map();
    private cardBackMaterial: StandardMaterial | null = null;

    private createCardMaterial(card: Card, faceUp: boolean): StandardMaterial {
        const cacheKey = faceUp ? `${card.getSuit()}-${card.getRank()}` : "cardBack";

        // Return cached material if available
        if (this.materialCache.has(cacheKey)) {
            return this.materialCache.get(cacheKey)!;
        }
         // Special handling for card back
         if (!faceUp && this.cardBackMaterial) {
             return this.cardBackMaterial;
         }


        console.log(`Creating material: ${cacheKey}`);
        const textureSize = { width: 256, height: 358 }; // Standard poker size ratio
        const texture = new DynamicTexture(
            `texture_${cacheKey}`,
            textureSize,
            this.scene,
            true // generateMipMaps
        );
        const ctx = texture.getContext();
        ctx.imageSmoothingEnabled = true; // Enable smoothing

        // Draw background
        ctx.fillStyle = faceUp ? "#FEFEFE" : "#B22222"; // White or Firebrick Red
        ctx.fillRect(0, 0, textureSize.width, textureSize.height);

        // Draw border
        const borderWidth = 8;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = borderWidth / 2; // Thinner border
        ctx.strokeRect(borderWidth / 2, borderWidth / 2, textureSize.width - borderWidth, textureSize.height - borderWidth);

        if (faceUp) {
            // Card Face Content
            const suit = card.getSuit();
            const rank = card.getRank();
            const color = (suit === Suit.Hearts || suit === Suit.Diamonds) ? "#FF0000" : "#000000"; // Red or Black
            const suitSymbols = { Hearts: "♥", Diamonds: "♦", Clubs: "♣", Spades: "♠" };
            const symbol = suitSymbols[suit];

            // Font settings
            const rankFontSize = 48;
            const suitFontSize = 40;
            const cornerRankFontSize = 24;
            const cornerSuitFontSize = 20;
            ctx.font = `bold ${rankFontSize}px Arial`;
            ctx.fillStyle = color;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // Main rank and suit
            ctx.fillText(rank, textureSize.width / 2, textureSize.height * 0.3);
            ctx.font = `bold ${suitFontSize}px Arial`;
            ctx.fillText(symbol, textureSize.width / 2, textureSize.height * 0.65);

            // Corner ranks and suits
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.font = `bold ${cornerRankFontSize}px Arial`;
            ctx.fillText(rank, 15, 10);
            ctx.font = `bold ${cornerSuitFontSize}px Arial`;
            ctx.fillText(symbol, 15, 10 + cornerRankFontSize + 2);

            // Bottom-right corner (rotated)
            ctx.save();
            ctx.textAlign = "right";
            ctx.textBaseline = "bottom";
            ctx.translate(textureSize.width - 15, textureSize.height - 10);
            ctx.rotate(Math.PI);
            ctx.font = `bold ${cornerRankFontSize}px Arial`;
            ctx.fillText(rank, 0, 0);
            ctx.font = `bold ${cornerSuitFontSize}px Arial`;
            ctx.fillText(symbol, 0, -(cornerRankFontSize + 2));
            ctx.restore();

        } else {
            // Card Back Pattern (Simple)
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 1;
            for (let i = 0; i < textureSize.width; i += 10) {
                ctx.moveTo(i, 0);
                ctx.lineTo(i, textureSize.height);
                ctx.moveTo(0, i);
                ctx.lineTo(textureSize.width, i);
            }
            ctx.stroke();
        }

        texture.update(false); // Update texture, false = no mipmap regen yet

        // Create material
        const material = new StandardMaterial(`material_${cacheKey}`, this.scene);
        material.diffuseTexture = texture;
        material.specularColor = new Color3(0.1, 0.1, 0.1); // Reduce specular highlights
        material.backFaceCulling = false; // Render both sides
         // Slight emission to make cards pop a bit
         material.emissiveColor = new Color3(0.1, 0.1, 0.1);


        // Cache the material
        this.materialCache.set(cacheKey, material);
         if (!faceUp) {
             this.cardBackMaterial = material;
         }

        return material;
    }
}
