// src/scenes/components/cardvisualizer-ts
import { Scene, Vector3, MeshBuilder, StandardMaterial, Color3, Texture,
    Mesh, Animation, DynamicTexture, EasingFunction, CubicEase, QuadraticEase, AnimationEvent, Material, BackEase } from "@babylonjs/core";
import { Card } from "../../game/Card";
import { BlackjackGame } from "../../game/BlackjackGame";

export class CardVisualizer {
    private scene: Scene;
    private blackjackGame: BlackjackGame;
    /** Stores references to the mesh associated with each card's unique ID. */
    private cardMeshes: Map<string, Mesh> = new Map();
    private deckPosition: Vector3;
    /** A simple flag, primarily used to prevent overlapping animation starts. More robust checking uses scene animatables. */
    private animationInProgress: boolean = false;
    private onAnimationCompleteCallback: (() => void) | null = null;

    // --- Constants ---
    private static readonly CARD_WIDTH = 1.0;
    private static readonly CARD_HEIGHT = 1.4;
    /** Horizontal distance between the centers of adjacent cards in a hand. */
    private static readonly CARD_SPACING = CardVisualizer.CARD_WIDTH + 0.15; // Width + gap
    /** Base Y position for cards on the table. */
    private static readonly CARD_Y_POS = 0.05;
    /** Slight vertical offset for each card in a stack to prevent Z-fighting. */
    private static readonly CARD_STACK_OFFSET = 0.002;
    /** Y position for the deck visual and the start/end point of deal animations. */
    private static readonly DECK_Y_POS = 0.01;
    /** Z position for player cards. */
    private static readonly PLAYER_Z_POS = 2.5;
    /** Z position for dealer cards. */
    private static readonly DEALER_Z_POS = -3.0;

    // Animation Timings & Parameters
    private static readonly DEAL_SLIDE_DURATION_MS = 450; // Slightly longer slide
    private static readonly DEAL_FLIP_DURATION_MS = 400; // Flip happens during slide
    private static readonly REPOSITION_DURATION_MS = 300;
    private static readonly FLIP_DURATION_MS = 300; // For hole card reveal
    private static readonly FPS = 60;

    private static readonly TEXTURE_BASE_PATH = "assets/textures/playingcards/";

    private materialCache: Map<string, StandardMaterial> = new Map();
    private cardBackMaterial: StandardMaterial | null = null;

    constructor(scene: Scene, blackjackGame: BlackjackGame, deckPosition: Vector3) {
        this.scene = scene;
        this.blackjackGame = blackjackGame;
        // Set deck position using constants for Y
        this.deckPosition = deckPosition.clone();
        this.deckPosition.y = CardVisualizer.DECK_Y_POS;

        // Listen for logical card flips from the game state
        this.blackjackGame.addCardFlipCallback(
             "cardVisualizerFlipHandler",
             (card) => {
                // console.log(`CardVisualizer received flip notification for ${card.toString()}`);
                this.updateCardVisual(card); // Trigger visual update (potentially animated flip)
             }
        );
        this.getCardBackMaterial(); // Pre-create back material for efficiency
    }

    /** Sets the callback function to be invoked when a visual animation sequence completes. */
    public setOnAnimationCompleteCallback(callback: () => void): void {
        this.onAnimationCompleteCallback = callback;
    }

    /** Creates or retrieves the standard material used for the back of cards. */
    public getCardBackMaterial(): StandardMaterial | null {
        if (!this.cardBackMaterial) {
            this.cardBackMaterial = this.createCardMaterial(null); // Pass null for back
        }
        return this.cardBackMaterial;
    }

    /**
     * Creates a card mesh at the deck position and initiates the deal animation.
     * The mesh starts visually face-down. The animation handles sliding, flipping (if needed),
     * and repositioning of existing cards in the target hand.
     * Assumes the card's logical faceUp state is already set in the Card object.
     * @param card The Card object being dealt.
     * @param index The final index of this card in the hand.
     * @param isPlayer True if dealing to the player, false for the dealer.
     * @param faceUp The intended final visual state (true=face up, false=face down).
     */
    public createCardMesh(card: Card, index: number, isPlayer: boolean, faceUp: boolean): void {
        const cardId = card.getUniqueId();
        if (this.cardMeshes.has(cardId)) {
            console.warn(`Card mesh already exists for ${card.toString()}. Re-creating or repositioning?`);
            // Avoid re-creating, maybe just reposition? Or log error?
            // For now, let's assume this shouldn't happen if logic is correct.
            // If it does, maybe dispose the old one first?
            this.cardMeshes.get(cardId)?.dispose();
            this.cardMeshes.delete(cardId);
            // Fall through to create new one
        }
        // console.log(`Creating card mesh for ${card.toString()} (faceUp=${faceUp}) at index ${index}, isPlayer=${isPlayer}`);

        // --- Animate Existing Cards in Hand ---
        // Calculate final hand size *after* this card is added
        const finalHandSize = this.getHandSize(isPlayer) + 1;
        this.repositionHandCards(isPlayer, finalHandSize); // Animate existing cards to their new spots

        // --- Create New Card Mesh ---
        const cardMesh = MeshBuilder.CreatePlane(
            `card_${cardId}`,
            { width: CardVisualizer.CARD_WIDTH, height: CardVisualizer.CARD_HEIGHT, sideOrientation: Mesh.DOUBLESIDE },
            this.scene
        );
        cardMesh.position = this.deckPosition.clone();
        // Start flat on the table, oriented along Z-axis
        cardMesh.rotation = new Vector3(Math.PI / 2, 0, 0); // Lay flat
        cardMesh.material = this.getCardBackMaterial(); // Always start showing the back
        this.cardMeshes.set(cardId, cardMesh);

        // --- Start Deal Animation for New Card ---
        const finalPosition = this.calculateCardPosition(index, isPlayer, finalHandSize);
        // Target Z rotation: 0 for face up, PI for face down (relative to flat X=PI/2)
        const finalRotationZ = faceUp ? 0 : Math.PI;
        this.animateCardDealing(cardMesh, finalPosition, finalRotationZ, faceUp, card);
    }

    /**
     * Creates a card mesh instantly at its final position without animation.
     * Used when restoring game state.
     */
    private createCardMeshInstant(card: Card, index: number, isPlayer: boolean): void {
        const cardId = card.getUniqueId();
        // console.log(`Creating card mesh INSTANTLY for ${card.toString()} (faceUp=${card.isFaceUp()})`);
        const cardMesh = MeshBuilder.CreatePlane(
            `card_${cardId}`,
            { width: CardVisualizer.CARD_WIDTH, height: CardVisualizer.CARD_HEIGHT, sideOrientation: Mesh.DOUBLESIDE },
            this.scene
        );
        const handSize = this.getHandSize(isPlayer); // Use current hand size for positioning
        const position = this.calculateCardPosition(index, isPlayer, handSize);
        const rotationZ = card.isFaceUp() ? 0 : Math.PI; // Z rotation based on logical state

        cardMesh.position = position;
        cardMesh.rotation = new Vector3(Math.PI / 2, 0, rotationZ); // Base rotation + Z flip state
        cardMesh.material = this.createCardMaterial(card.isFaceUp() ? card : null); // Set correct material
        this.cardMeshes.set(cardId, cardMesh);
    }

    /** Gets the current number of cards in the specified hand from the game logic. */
    private getHandSize(isPlayer: boolean): number {
        return isPlayer ? this.blackjackGame.getPlayerHand().length : this.blackjackGame.getDealerHand().length;
    }

    /**
     * Renders cards based on the current game state. Creates missing meshes instantly
     * (used for state restoration) or updates existing visuals. Removes stale meshes.
     * @param isRestoring If true, creates meshes instantly without animation.
     */
    public renderCards(isRestoring: boolean = false): void {
        // console.log(`Rendering cards... isRestoring: ${isRestoring}`);
        const playerHand = this.blackjackGame.getPlayerHand();
        const dealerHand = this.blackjackGame.getDealerHand();
        const allHands = [{ hand: playerHand, isPlayer: true }, { hand: dealerHand, isPlayer: false }];
        const currentCardIds = new Set<string>();

        allHands.forEach(({ hand, isPlayer }) => {
            const handSize = hand.length;
            hand.forEach((card, index) => {
                const cardId = card.getUniqueId();
                currentCardIds.add(cardId);
                let cardMesh = this.cardMeshes.get(cardId);

                if (!cardMesh) {
                    // Mesh doesn't exist
                    if (isRestoring) {
                        // console.log(`Restoring card: ${card.toString()}`);
                        this.createCardMeshInstant(card, index, isPlayer);
                    } else {
                        // This case means a card exists in logic but not visually, outside of restoration.
                        // Should ideally not happen if deal logic is correct. Log warning.
                        console.warn(`renderCards creating missing mesh for ${card.toString()} outside restoration.`);
                        this.createCardMeshInstant(card, index, isPlayer); // Create instantly to sync state
                    }
                } else {
                    // Mesh exists, ensure its visual state matches the logical state
                    // Reposition instantly if restoring, otherwise repositioning is handled by deal/repositionHandCards
                    if (isRestoring) {
                        const targetPos = this.calculateCardPosition(index, isPlayer, handSize);
                        cardMesh.position = targetPos;
                        this.updateCardVisual(card, true); // Force immediate visual update (material/rotation)
                    } else {
                        // If not restoring, visual updates (flips) are handled by the flip callback (updateCardVisual)
                        // and repositioning is handled by repositionHandCards during dealing.
                        // We might still need to ensure the material/rotation is correct if a flip happened
                        // without animation somehow, but updateCardVisual should handle this if called.
                    }
                }
            });
        });

        // Remove meshes for cards that are no longer in either hand
        this.cardMeshes.forEach((mesh, cardId) => {
            if (!currentCardIds.has(cardId)) {
                // console.log(`Disposing stale card mesh: ${mesh.name}`);
                this.scene.stopAnimation(mesh); // Stop any animations before disposing
                mesh.dispose();
                this.cardMeshes.delete(cardId);
            }
        });
        // console.log(`Render complete. Total meshes: ${this.cardMeshes.size}`);
    }

    /**
     * Animates the repositioning of all cards currently in the specified hand
     * to achieve a centered layout based on the new total hand size.
     * @param isPlayer True for player's hand, false for dealer's.
     * @param newHandSize The final number of cards the hand will have.
     */
    private repositionHandCards(isPlayer: boolean, newHandSize: number): void {
        const hand = isPlayer ? this.blackjackGame.getPlayerHand() : this.blackjackGame.getDealerHand();
        // console.log(`Repositioning ${isPlayer ? 'Player' : 'Dealer'} hand for new size ${newHandSize}`);

        hand.forEach((card, index) => {
            const cardMesh = this.cardMeshes.get(card.getUniqueId());
            if (cardMesh) {
                const newPosition = this.calculateCardPosition(index, isPlayer, newHandSize);
                // Only animate if position actually changes significantly
                if (!cardMesh.position.equalsWithEpsilon(newPosition, 0.01)) {
                    // console.log(`Animating ${card.toString()} to ${newPosition}`);
                    // Use a slightly different easing for repositioning
                    const ease = new BackEase(0.3); // Slight overshoot/settle
                    ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
                    this.animateVector3(
                        cardMesh,
                        "position",
                        newPosition,
                        CardVisualizer.REPOSITION_DURATION_MS,
                        ease,
                        false // Don't trigger main completion callback for repositioning
                    );
                }
            } else {
                // This might happen if called very rapidly, log warning but continue
                console.warn(`Cannot reposition card ${card.toString()}, mesh not found yet.`);
            }
        });
    }

    /**
     * Calculates the target world position for a card within a hand.
     * Positions cards centered horizontally based on hand size and spacing.
     * @param index The index of the card in the hand (0-based).
     * @param isPlayer True if the card belongs to the player, false for the dealer.
     * @param handSize The total number of cards in the hand.
     * @returns The calculated Vector3 position.
     */
    private calculateCardPosition(index: number, isPlayer: boolean, handSize: number): Vector3 {
        const zPos = isPlayer ? CardVisualizer.PLAYER_Z_POS : CardVisualizer.DEALER_Z_POS;
        const yPos = CardVisualizer.CARD_Y_POS + (index * CardVisualizer.CARD_STACK_OFFSET);

        // Calculate centered X positions
        const totalWidth = (handSize - 1) * CardVisualizer.CARD_SPACING;
        const startX = -(totalWidth / 2);
        const xPos = startX + (index * CardVisualizer.CARD_SPACING);

        return new Vector3(xPos, yPos, zPos);
    }

    /**
     * Updates a card mesh's visual state (material and rotation) to match the Card object's state.
     * Animates the flip if necessary and not forced immediate. Called by the flip callback.
     * @param card The card object whose visual needs updating.
     * @param forceImmediate If true, sets state instantly without animation.
     */
    public updateCardVisual(card: Card, forceImmediate: boolean = false): void {
        const cardId = card.getUniqueId();
        const cardMesh = this.cardMeshes.get(cardId);
        if (!cardMesh) { console.warn(`Cannot update visual for card ${card.toString()}, mesh not found.`); return; }
        // console.log(`Updating visual for ${card.toString()} to faceUp=${card.isFaceUp()}, forceImmediate=${forceImmediate}`);

        const targetRotationZ = card.isFaceUp() ? 0 : Math.PI; // Target Z rotation
        const targetMaterial = this.createCardMaterial(card.isFaceUp() ? card : null);

        if (!targetMaterial) { console.error(`Could not get material for card ${card.toString()}`); return; }

        // Use epsilon for float comparison of rotation
        const rotationDifference = Math.abs(cardMesh.rotation.z - targetRotationZ);
        const needsRotation = rotationDifference > 0.01 && rotationDifference < (2 * Math.PI - 0.01); // Avoid animating full circle

        if (forceImmediate || !needsRotation) {
            // console.log(`Setting visual immediately for ${card.toString()}`);
            cardMesh.rotation.z = targetRotationZ;
            cardMesh.material = targetMaterial; // Ensure material is also set immediately
        } else {
             // Animate the flip (e.g., for dealer hole card reveal)
             // console.log(`Animating flip for ${card.toString()}`);
             this.animateFlip(cardMesh, targetRotationZ, targetMaterial);
        }
    }

    /** Removes all card meshes from the scene and clears the internal map. */
    public clearTable(): void {
        // console.log("Clearing table visuals..."); // Reduce log noise
        this.animationInProgress = false; // Reset flag
        this.cardMeshes.forEach(mesh => {
            this.scene.stopAnimation(mesh); // Stop animations
            mesh.dispose();
        });
        this.cardMeshes.clear();
    }

    /** Checks if any card-related animations are currently running. */
    public isAnimationInProgress(): boolean {
        // Check scene animatables targeting any card mesh
        for (const mesh of this.cardMeshes.values()) {
            if (this.scene.getAllAnimatablesByTarget(mesh).length > 0) {
                return true; // Found an active animation
            }
        }
        // Fallback check on the simple flag for edge cases between animation calls
        return this.animationInProgress;
    }

    // --- Animation Implementations ---

    /**
     * Animates a card dealing from the deck to its target position and rotation.
     * Includes a 3D flip effect by animating rotation.z while sliding.
     * The final onAnimationEnd triggers the main completion callback.
     */
    private animateCardDealing(mesh: Mesh, targetPos: Vector3, targetRotZ: number, faceUp: boolean, card: Card): void {
        this.animationInProgress = true; // Mark start
        const slideFrames = CardVisualizer.DEAL_SLIDE_DURATION_MS / 1000 * CardVisualizer.FPS;
        const flipFrames = CardVisualizer.DEAL_FLIP_DURATION_MS / 1000 * CardVisualizer.FPS; // Can be different from slide

        const slideEase = new CubicEase(); slideEase.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
        const flipEase = new QuadraticEase(); flipEase.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

        // 1. Position Animation (Slide)
        const posAnim = new Animation("dealPosAnim", "position", CardVisualizer.FPS, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
        posAnim.setKeys([{ frame: 0, value: mesh.position.clone() }, { frame: slideFrames, value: targetPos }]);
        posAnim.setEasingFunction(slideEase);

        // 2. Rotation Animation (Flip) - Animates Z rotation relative to the base X=PI/2
        const startRotationZ = mesh.rotation.z; // Should be 0 initially
        const rotAnim = new Animation("dealRotAnim", "rotation.z", CardVisualizer.FPS, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        // Flip happens over 'flipFrames' duration
        rotAnim.setKeys([{ frame: 0, value: startRotationZ }, { frame: flipFrames, value: targetRotZ }]);
        rotAnim.setEasingFunction(flipEase);

        // 3. Material Change Event (Only if dealing face up)
        const targetMaterial = faceUp ? this.createCardMaterial(card) : this.getCardBackMaterial();
        if (faceUp && targetMaterial && mesh.material !== targetMaterial) {
             // Change material halfway through the *flip* duration
             const materialUpdateEvent = new AnimationEvent(flipFrames / 2, () => {
                 // console.log(`Updating material mid-deal for ${card.toString()} to face`);
                 mesh.material = targetMaterial;
             }, true); // Only once
             rotAnim.addEvent(materialUpdateEvent);
        } else if (!targetMaterial) {
             console.error(`Could not get target material for ${card.toString()} during deal animation.`);
        }

        // console.log(`Starting deal animation for ${card.toString()} to pos ${targetPos}, rotZ ${targetRotZ}`);
        // Run both animations. The overall duration is the max of the two.
        // The callback runs after the longest animation finishes.
        const overallFrames = Math.max(slideFrames, flipFrames);
        this.scene.beginDirectAnimation(mesh, [posAnim, rotAnim], 0, overallFrames, false, 1,
            () => {
                // console.log(`Deal animation complete for ${card.toString()}`);
                // Ensure final state is precisely set
                mesh.position = targetPos;
                mesh.rotation.z = targetRotZ;
                if (targetMaterial) mesh.material = targetMaterial; // Ensure final material

                this.animationInProgress = false; // Clear flag
                if (this.onAnimationCompleteCallback) {
                    this.onAnimationCompleteCallback(); // Notify controller
                } else {
                    console.warn("Deal animation finished, but no onAnimationCompleteCallback set.");
                }
            }
        );
    }

    /**
     * Animates a flip of an existing card (e.g., revealing dealer hole card).
     * Only animates rotation.z and changes material halfway.
     * The final onAnimationEnd triggers the main completion callback.
     */
     private animateFlip(mesh: Mesh, targetRotationZ: number, targetMaterial: StandardMaterial): void {
        this.animationInProgress = true; // Mark start
        const durationFrames = CardVisualizer.FLIP_DURATION_MS / 1000 * CardVisualizer.FPS;
        const easing = new QuadraticEase(); easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

        const startRotationZ = mesh.rotation.z;
        // console.log(`Starting flip animation for ${mesh.name} from rotZ ${startRotationZ} to ${targetRotationZ}`);

        const rotAnim = new Animation("flipRotAnim", "rotation.z", CardVisualizer.FPS, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        rotAnim.setKeys([{ frame: 0, value: startRotationZ }, { frame: durationFrames, value: targetRotationZ }]);
        rotAnim.setEasingFunction(easing);

        // Schedule material change halfway through the flip
        const materialUpdateEvent = new AnimationEvent(durationFrames / 2, () => {
            // console.log(`Updating material mid-flip for ${mesh.name}`);
            mesh.material = targetMaterial;
        }, true); // Only once
        rotAnim.addEvent(materialUpdateEvent);

        this.scene.beginDirectAnimation(mesh, [rotAnim], 0, durationFrames, false, 1, () => {
            // console.log(`Flip animation complete for ${mesh.name}`);
            // Ensure final state is correct
            mesh.rotation.z = targetRotationZ;
            mesh.material = targetMaterial; // Ensure final material

            this.animationInProgress = false; // Clear flag
            if (this.onAnimationCompleteCallback) {
                 this.onAnimationCompleteCallback(); // Notify controller
            } else {
                 console.warn("Flip animation finished, but no onAnimationCompleteCallback set.");
            }
        });
    }

    /**
     * Helper function to animate a Vector3 property (e.g., position, rotation) of a mesh.
     * @param mesh The target mesh.
     * @param property The name of the Vector3 property to animate ("position" or "rotation").
     * @param targetValue The target Vector3 value.
     * @param durationMs The duration of the animation in milliseconds.
     * @param easing Optional easing function. Defaults to CubicEase Out.
     * @param triggerCompletionCallback If true (default), triggers the main onAnimationCompleteCallback. Set to false for secondary animations like repositioning.
     */
    private animateVector3(mesh: Mesh, property: "position" | "rotation", targetValue: Vector3, durationMs: number, easing?: EasingFunction, triggerCompletionCallback: boolean = true): void {
        this.animationInProgress = true; // Mark start
        const durationFrames = durationMs / 1000 * CardVisualizer.FPS;
        const effectiveEasing = easing ?? new CubicEase();
        if (!easing) effectiveEasing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

        const anim = new Animation(`${property}Anim_${mesh.name}_${Date.now()}`, // Unique name
                                property, CardVisualizer.FPS, Animation.ANIMATIONTYPE_VECTOR3,
                                Animation.ANIMATIONLOOPMODE_CONSTANT);

        let startValue: Vector3;
        if (property === 'position') { startValue = mesh.position.clone(); }
        else if (property === 'rotation') { startValue = mesh.rotation.clone(); }
        else {
            console.error(`animateVector3 called with unsupported property: ${property}`);
            this.animationInProgress = false; // Clear flag on error
            return;
        }

        // Only animate if target is significantly different from start
        if (startValue.equalsWithEpsilon(targetValue, 0.001)) {
             // console.log(`Skipping ${property} animation for ${mesh.name}, already at target.`);
             this.animationInProgress = false; // Clear flag
             // If we were supposed to trigger the callback, do it now since animation is "complete" instantly
             if (triggerCompletionCallback && this.onAnimationCompleteCallback) {
                 // Use timeout to avoid potential re-entrancy issues if called synchronously
                 setTimeout(() => { if (this.onAnimationCompleteCallback) this.onAnimationCompleteCallback(); }, 0);
             }
             return;
        }

        anim.setKeys([{ frame: 0, value: startValue }, { frame: durationFrames, value: targetValue }]);
        anim.setEasingFunction(effectiveEasing);

        this.scene.beginDirectAnimation(mesh, [anim], 0, durationFrames, false, 1, () => {
            // Ensure final value is set precisely
            if (property === 'position') mesh.position = targetValue;
            else if (property === 'rotation') mesh.rotation = targetValue;

            this.animationInProgress = false; // Clear flag
            if (triggerCompletionCallback && this.onAnimationCompleteCallback) {
                 this.onAnimationCompleteCallback(); // Notify controller
            }
        });
    }

    // --- Material Creation ---

    /** Gets the URL for the card face texture based on suit and rank. */
    private getFaceTextureUrl(card: Card): string {
        const suitStr = card.getSuit().toUpperCase();
        // Use the dedicated method from Card class for texture rank value
        const rankVal = card.getRankValueForTexture();
        return `${CardVisualizer.TEXTURE_BASE_PATH}${suitStr} ${rankVal}.png`;
    }

    /**
     * Creates or retrieves a cached material for a card face or back.
     * Handles texture loading for faces and dynamic texture generation for the back.
     * @param card The Card object for a face material, or null for the back material.
     * @returns The StandardMaterial instance or null if creation failed.
     */
    private createCardMaterial(card: Card | null): StandardMaterial | null {
        const isFace = card !== null;
        const cacheKey = isFace ? this.getFaceTextureUrl(card!) : "dynamicCardBack_Rounded";

        // Return cached material if available
        if (this.materialCache.has(cacheKey)) {
            return this.materialCache.get(cacheKey)!;
        }
        // Special check for back material instance
        if (!isFace && this.cardBackMaterial) {
            return this.cardBackMaterial;
        }

        const material = new StandardMaterial(`material_${cacheKey.replace(/[^a-zA-Z0-9]/g, '_')}`, this.scene);

        try {
            if (isFace) {
                // --- Face Material ---
                const texture = new Texture(cacheKey, this.scene, false, true, Texture.TRILINEAR_SAMPLINGMODE,
                    null, // onLoad
                    (message, exception) => { // onError
                        console.error(`Error loading texture ${cacheKey}: ${message}`, exception);
                        material!.diffuseColor = new Color3(1, 0, 1); // Error color (Magenta)
                    }
                );
                texture.hasAlpha = true; // Assume PNGs might have alpha
                material.diffuseTexture = texture;
                material.useAlphaFromDiffuseTexture = true;
                material.transparencyMode = Material.MATERIAL_ALPHABLEND; // Blend alpha edges
            } else {
                // --- Back Material (Dynamic Texture) ---
                const textureSize = { width: 256, height: 358 }; // Aspect ratio ~1:1.4
                const cornerRadius = 30;
                const texture = new DynamicTexture(`texture_${cacheKey}`, textureSize, this.scene, true);
                const ctx = texture.getContext() as CanvasRenderingContext2D;

                // Clear with transparency
                ctx.clearRect(0, 0, textureSize.width, textureSize.height);

                // Rounded rectangle path
                ctx.beginPath();
                ctx.moveTo(cornerRadius, 0);
                ctx.lineTo(textureSize.width - cornerRadius, 0);
                ctx.arcTo(textureSize.width, 0, textureSize.width, cornerRadius, cornerRadius);
                ctx.lineTo(textureSize.width, textureSize.height - cornerRadius);
                ctx.arcTo(textureSize.width, textureSize.height, textureSize.width - cornerRadius, textureSize.height, cornerRadius);
                ctx.lineTo(cornerRadius, textureSize.height);
                ctx.arcTo(0, textureSize.height, 0, textureSize.height - cornerRadius, cornerRadius);
                ctx.lineTo(0, cornerRadius);
                ctx.arcTo(0, 0, cornerRadius, 0, cornerRadius);
                ctx.closePath();

                // Fill and border
                ctx.fillStyle = "#B22222"; // Firebrick red
                ctx.fill();
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 4;
                ctx.stroke();

                // Subtle pattern (optional)
                ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
                ctx.lineWidth = 1;
                const spacing = 10;
                for (let i = -textureSize.height; i < textureSize.width; i += spacing) {
                    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + textureSize.height, textureSize.height); ctx.stroke();
                }

                // Enable smoothing
                ctx.imageSmoothingEnabled = true;

                texture.update(false); // Update texture, no mipmaps needed after creation

                material.diffuseTexture = texture;
                material.useAlphaFromDiffuseTexture = true;
                material.transparencyMode = Material.MATERIAL_ALPHABLEND; // Crucial for rounded corners

                this.cardBackMaterial = material; // Store the singleton instance
            }

            // Common material properties
            material.emissiveColor = new Color3(0, 0, 0); // No self-illumination
            material.specularColor = new Color3(0.1, 0.1, 0.1); // Low shininess
            material.backFaceCulling = false; // Render both sides
            material.separateCullingPass = true; // Helps with transparency sorting

            this.materialCache.set(cacheKey, material); // Cache the material
            return material;

        } catch (error) {
            console.error(`Failed to create material for ${cacheKey}:`, error);
            material?.dispose(); // Dispose partially created material on error
            return null;
        }
    }
}
