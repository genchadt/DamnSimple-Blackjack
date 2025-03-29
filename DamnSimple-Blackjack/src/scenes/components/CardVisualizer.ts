// src/scenes/components/cardvisualizer.ts
// FINAL FINAL FINAL ATTEMPT: Use Quaternions for rotation. (Corrected TS errors)
import { Scene, Vector3, MeshBuilder, StandardMaterial, Color3, Texture, DynamicTexture,
    Mesh, Animation, EasingFunction, CubicEase, QuadraticEase, Material, BackEase, MultiMaterial, Vector4, SubMesh, Quaternion } from "@babylonjs/core";
import { Card } from "../../game/Card";
import { BlackjackGame } from "../../game/BlackjackGame";

export class CardVisualizer {
    private scene: Scene;
    private blackjackGame: BlackjackGame;
    private cardMeshes: Map<string, Mesh> = new Map();
    private deckPosition: Vector3;
    private animationInProgress: boolean = false;
    private onAnimationCompleteCallback: (() => void) | null = null;

    // --- Constants ---
    private static readonly CARD_WIDTH = 1.0;
    private static readonly CARD_HEIGHT = 1.4;
    private static readonly CARD_DEPTH = 0.02;
    private static readonly CARD_SPACING = CardVisualizer.CARD_WIDTH + 1.1;
    private static readonly CARD_Y_POS = 0.05;
    private static readonly CARD_STACK_OFFSET = CardVisualizer.CARD_DEPTH + 0.002;
    private static readonly DECK_Y_POS = CardVisualizer.CARD_HEIGHT / 2 + 0.01;
    private static readonly PLAYER_Z_POS = 2.5;
    private static readonly DEALER_Z_POS = -3.0;

    // Animation Timings & Parameters
    private static readonly DEAL_SLIDE_DURATION_MS = 450;
    private static readonly DEAL_ROTATION_DURATION_MS = 400; // Duration for quaternion rotation
    private static readonly REPOSITION_DURATION_MS = 300;
    private static readonly FLIP_DURATION_MS = 350; // Duration for flip quaternion animation
    private static readonly FPS = 60;

    private static readonly TEXTURE_BASE_PATH = "assets/textures/playingcards/";

    // Material Cache / Singletons
    private materialCache: Map<string, StandardMaterial> = new Map(); // General cache (can be removed if specific ones used)
    private cardBackMaterial: StandardMaterial | null = null;
    private cardSideMaterial: StandardMaterial | null = null;
    private cardFaceMaterials: Map<string, StandardMaterial> = new Map();

    // Fallback Colors
    private static readonly FALLBACK_FACE_COLOR = new Color3(0.8, 0.8, 1.0);
    private static readonly FALLBACK_BACK_COLOR = new Color3(1.0, 0.6, 0.6);

    // Submesh indices
    private static readonly SUBMESH_PLUS_Z = 0;
    private static readonly SUBMESH_MINUS_Z = 1;
    private static readonly SUBMESH_PLUS_X = 2;
    private static readonly SUBMESH_MINUS_X = 3;
    private static readonly SUBMESH_PLUS_Y = 4;
    private static readonly SUBMESH_MINUS_Y = 5;

    // Material indices
    private static readonly MATIDX_FACE = 0;
    private static readonly MATIDX_BACK = 1;
    private static readonly MATIDX_SIDE = 2;

    // --- Target Quaternions ---
    private static readonly FACE_UP_FLAT_QUAT = Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2);
    private static readonly FACE_DOWN_FLAT_QUAT = Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2).multiply(Quaternion.RotationAxis(Vector3.Up(), Math.PI));
    private static readonly QUATERNION_EPSILON = 0.001; // For comparisons

    constructor(scene: Scene, blackjackGame: BlackjackGame, deckPosition: Vector3) {
        this.scene = scene;
        this.blackjackGame = blackjackGame;
        this.deckPosition = deckPosition.clone();
        this.deckPosition.y = CardVisualizer.DECK_Y_POS;

        this.blackjackGame.addCardFlipCallback(
             "cardVisualizerFlipHandler",
             (card) => this.updateCardVisual(card, false) // Use flip animation
        );
        this.getCardBackMaterial(); // Pre-cache back
        this.getCardSideMaterial(); // Pre-cache side
        console.log("[CardViz] Initialized (Using Quaternions for Rotation).");
        // Log target quaternions for debugging
        console.log(`[CardViz] FACE_UP_FLAT_QUAT: ${CardVisualizer.FACE_UP_FLAT_QUAT.toString()}`);
        console.log(`[CardViz] FACE_DOWN_FLAT_QUAT: ${CardVisualizer.FACE_DOWN_FLAT_QUAT.toString()}`);
    }

    public setOnAnimationCompleteCallback(callback: () => void): void {
        this.onAnimationCompleteCallback = callback;
    }

    // --- Material Getters ---
    public getCardBackMaterial(): StandardMaterial {
        if (!this.cardBackMaterial) {
            this.cardBackMaterial = this.createCardMaterialInternal(null); // null signifies back material
        }
        return this.cardBackMaterial!; // Assume it's created successfully
    }

    public getCardSideMaterial(): StandardMaterial {
        if (!this.cardSideMaterial) {
             this.cardSideMaterial = new StandardMaterial("cardSideMat", this.scene);
             this.cardSideMaterial.diffuseColor = new Color3(0.85, 0.85, 0.85);
             this.cardSideMaterial.specularColor = new Color3(0.05, 0.05, 0.05);
        }
        return this.cardSideMaterial;
    }

    // Gets or creates a specific face material
    public getCardFaceMaterial(card: Card): StandardMaterial {
        const cacheKey = this.getFaceTextureUrl(card);
        if (!this.cardFaceMaterials.has(cacheKey)) {
            this.cardFaceMaterials.set(cacheKey, this.createCardMaterialInternal(card));
        }
        return this.cardFaceMaterials.get(cacheKey)!;
    }
    // --- End Material Getters ---


    public createCardMesh(card: Card, index: number, isPlayer: boolean, faceUp: boolean): void {
        const target = isPlayer ? 'Player' : 'Dealer';
        console.log(`%c[CardViz] createCardMesh called for ${card.toString()} to ${target}. Index: ${index}, FaceUp (target): ${faceUp}`, 'color: #20B2AA');

        const cardId = card.getUniqueId();
        if (this.cardMeshes.has(cardId)) {
            console.warn(`[CardViz] Card mesh ${cardId} already exists. Disposing and recreating.`);
            this.cardMeshes.get(cardId)?.dispose();
            this.cardMeshes.delete(cardId);
        }

        const finalHandSize = this.getHandSize(isPlayer) + 1;

        const backUV = new Vector4(0, 0, 1, 1); const faceUV = new Vector4(0, 0, 1, 1);
        const sideUV = new Vector4(0, 0, 0.01, 0.01);
        const boxFaceUVs = [backUV, faceUV, sideUV, sideUV, sideUV, sideUV];

        console.log(`%c[CardViz]   -> Creating BOX mesh.`, 'color: green;');
        const cardMesh = MeshBuilder.CreateBox(
            `card_${cardId}`, {
                width: CardVisualizer.CARD_WIDTH, height: CardVisualizer.CARD_HEIGHT,
                depth: CardVisualizer.CARD_DEPTH, faceUV: boxFaceUVs
            }, this.scene
        );

        cardMesh.position = this.deckPosition.clone();
        // --- Use Quaternion for initial rotation (standing up = identity) ---
        cardMesh.rotationQuaternion = Quaternion.Identity();
        console.log(`%c[CardViz]   -> Mesh created at deck position. Initial rotationQuaternion: ${cardMesh.rotationQuaternion.toString()}`, 'color: #FF4500; font-weight: bold;');

        // --- Apply MultiMaterial (same as before) ---
        const multiMat = new MultiMaterial(`multiMat_${cardId}`, this.scene);
        multiMat.subMaterials.push(this.getCardFaceMaterial(card)); // 0: Face
        multiMat.subMaterials.push(this.getCardBackMaterial());     // 1: Back
        multiMat.subMaterials.push(this.getCardSideMaterial());     // 2: Side
        cardMesh.material = multiMat;

        // --- Assign Initial SubMeshes (Original: Face on -Z, Back on +Z) ---
        console.log(`%c[CardViz]   -> Applying ORIGINAL SubMesh assignments (Back[${CardVisualizer.MATIDX_BACK}] on +Z, Face[${CardVisualizer.MATIDX_FACE}] on -Z).`, 'color: green; font-weight: bold;');
        cardMesh.subMeshes = [];
        const verticesCount = cardMesh.getTotalVertices();
        new SubMesh(CardVisualizer.MATIDX_BACK, 0, verticesCount, 0, 6, cardMesh);  // +Z -> Back
        new SubMesh(CardVisualizer.MATIDX_FACE, 0, verticesCount, 6, 6, cardMesh);  // -Z -> Face
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 12, 6, cardMesh); // +X -> Side
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 18, 6, cardMesh); // -X -> Side
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 24, 6, cardMesh); // +Y -> Side
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 30, 6, cardMesh); // -Y -> Side

        this.cardMeshes.set(cardId, cardMesh);
        console.log(`%c[CardViz]   -> Mesh added to cardMeshes map.`, 'color: #20B2AA');

        // --- Start Deal Animation (Position and Quaternion Rotation) ---
        const finalPosition = this.calculateCardPosition(index, isPlayer, finalHandSize);
        // Determine target Quaternion based on faceUp state
        const targetQuaternion = faceUp ? CardVisualizer.FACE_UP_FLAT_QUAT : CardVisualizer.FACE_DOWN_FLAT_QUAT;
        console.log(`%c[CardViz]   -> Calculated final position: ${finalPosition.toString()}`, 'color: #20B2AA');
        console.log(`%c[CardViz]   -> Target Quaternion (FaceUp=${faceUp}): ${targetQuaternion.toString()}`, 'color: #20B2AA; font-weight: bold;');
        console.log(`%c[CardViz]   -> Calling animateCardDealing (using Quaternions)...`, 'color: #20B2AA');

        this.animateCardDealing(cardMesh, finalPosition, targetQuaternion, card);
    }

    private createCardMeshInstant(card: Card, index: number, isPlayer: boolean): void {
        const cardId = card.getUniqueId();
        console.log(`%c[CardViz] createCardMeshInstant for ${card.toString()}. IsPlayer: ${isPlayer}, Index: ${index}, FaceUp: ${card.isFaceUp()}`, 'color: #4682B4');

        const backUV = new Vector4(0, 0, 1, 1); const faceUV = new Vector4(0, 0, 1, 1);
        const sideUV = new Vector4(0, 0, 0.01, 0.01);
        const boxFaceUVs = [backUV, faceUV, sideUV, sideUV, sideUV, sideUV];

        const cardMesh = MeshBuilder.CreateBox(
            `card_${cardId}`, {
                width: CardVisualizer.CARD_WIDTH, height: CardVisualizer.CARD_HEIGHT,
                depth: CardVisualizer.CARD_DEPTH, faceUV: boxFaceUVs,
            }, this.scene
        );

        const handSize = this.getHandSize(isPlayer);
        const position = this.calculateCardPosition(index, isPlayer, handSize);
        cardMesh.position = position;

        // --- Set final rotationQuaternion directly ---
        const targetQuaternion = card.isFaceUp() ? CardVisualizer.FACE_UP_FLAT_QUAT : CardVisualizer.FACE_DOWN_FLAT_QUAT;
        cardMesh.rotationQuaternion = targetQuaternion.clone();
        console.log(`%c[CardViz]   -> Instant Position: ${position.toString()}`, 'color: #4682B4');
        console.log(`%c[CardViz]   -> Instant rotationQuaternion: ${cardMesh.rotationQuaternion.toString()}`, 'color: #4682B4');

        // --- Apply MultiMaterial (same as before) ---
        const multiMat = new MultiMaterial(`multiMat_${cardId}_instant`, this.scene);
        multiMat.subMaterials.push(this.getCardFaceMaterial(card)); // 0: Face
        multiMat.subMaterials.push(this.getCardBackMaterial());     // 1: Back
        multiMat.subMaterials.push(this.getCardSideMaterial());     // 2: Side
        cardMesh.material = multiMat;

        // --- Assign Initial SubMeshes (Original: Face on -Z, Back on +Z) ---
        console.log(`%c[CardViz]   -> Applying ORIGINAL SubMesh assignments (Instant).`, 'color: green; font-weight: bold;');
        cardMesh.subMeshes = [];
        const verticesCount = cardMesh.getTotalVertices();
        new SubMesh(CardVisualizer.MATIDX_BACK, 0, verticesCount, 0, 6, cardMesh);  // +Z -> Back
        new SubMesh(CardVisualizer.MATIDX_FACE, 0, verticesCount, 6, 6, cardMesh);  // -Z -> Face
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 12, 6, cardMesh); // +X -> Side
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 18, 6, cardMesh); // -X -> Side
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 24, 6, cardMesh); // +Y -> Side
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 30, 6, cardMesh); // -Y -> Side

        this.cardMeshes.set(cardId, cardMesh);
        // No need to call updateCardVisual here, rotationQuaternion is set directly
    }

    // --- FIX: Added return type ---
    private getHandSize(isPlayer: boolean): number {
        return isPlayer ? this.blackjackGame.getPlayerHand().length : this.blackjackGame.getDealerHand().length;
    }

    public renderCards(isRestoring: boolean = false): void {
        console.log(`%c[CardViz] renderCards called. IsRestoring: ${isRestoring}`, 'color: #4682B4');
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
                    console.log(`%c[CardViz]   -> Mesh for ${card.toString()} not found. Creating instant mesh.`, 'color: #4682B4');
                    // createCardMeshInstant sets position and final rotationQuaternion
                    this.createCardMeshInstant(card, index, isPlayer);
                } else {
                    // If mesh exists, ensure its position and rotation are correct for the current state
                    const targetPos = this.calculateCardPosition(index, isPlayer, handSize);
                    const targetQuat = card.isFaceUp() ? CardVisualizer.FACE_UP_FLAT_QUAT : CardVisualizer.FACE_DOWN_FLAT_QUAT;

                    if (!cardMesh.position.equalsWithEpsilon(targetPos)) {
                        cardMesh.position = targetPos; // Set position directly
                    }
                    if (!cardMesh.rotationQuaternion) cardMesh.rotationQuaternion = Quaternion.Identity(); // Ensure quaternion exists
                    if (!cardMesh.rotationQuaternion.equalsWithEpsilon(targetQuat, CardVisualizer.QUATERNION_EPSILON)) {
                        cardMesh.rotationQuaternion = targetQuat.clone(); // Set rotation directly
                    }

                    if (isRestoring) {
                        console.log(`%c[CardViz]   -> Restored mesh position/rotation for ${card.toString()}.`, 'color: #4682B4');
                        console.log(`%c[CardViz]     -> Pos: ${targetPos.toString()}, Quat: ${targetQuat.toString()}`, 'color: #4682B4');
                    }
                }
            });
        });

        // Cleanup: Remove meshes for cards no longer in either hand
        this.cardMeshes.forEach((mesh, cardId) => {
            if (!currentCardIds.has(cardId)) {
                 console.log(`%c[CardViz]   -> Disposing mesh for removed card: ${cardId}`, 'color: #4682B4');
                this.scene.stopAnimation(mesh); // Stop any running animations
                mesh.dispose();
                this.cardMeshes.delete(cardId);
            }
        });
    }

    private repositionHandCards(isPlayer: boolean, newHandSize: number): void {
        const hand = isPlayer ? this.blackjackGame.getPlayerHand() : this.blackjackGame.getDealerHand();
        hand.forEach((card, index) => {
            const cardMesh = this.cardMeshes.get(card.getUniqueId());
            if (cardMesh) {
                const newPosition = this.calculateCardPosition(index, isPlayer, newHandSize);
                if (!cardMesh.position.equalsWithEpsilon(newPosition, 0.01)) {
                    const ease = new BackEase(0.3); ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
                    // Animate position only, don't trigger full completion callback
                    this.animateVector3(cardMesh, "position", newPosition, CardVisualizer.REPOSITION_DURATION_MS, ease, false);
                }
            } else {
                 console.warn(`[CardViz] Cannot reposition card ${card.toString()}, mesh not found in map during repositioning.`);
            }
        });
    }

    // --- FIX: Added return type ---
    private calculateCardPosition(index: number, isPlayer: boolean, handSize: number): Vector3 {
        const zPos = isPlayer ? CardVisualizer.PLAYER_Z_POS : CardVisualizer.DEALER_Z_POS;
        const yPos = CardVisualizer.CARD_Y_POS; // Cards are flat on the table Y
        const stackOffset = (index * CardVisualizer.CARD_STACK_OFFSET); // Apply small offset for visual separation

        // Calculate total width needed for the hand based on spacing
        const totalWidth = (handSize - 1) * CardVisualizer.CARD_SPACING;
        // Calculate the starting X position to center the hand
        const startX = -(totalWidth / 2);
        // Calculate the X position for the current card
        const xPos = startX + (index * CardVisualizer.CARD_SPACING);

        // Adjust Y based on stack offset - higher index = slightly higher Y
        return new Vector3(xPos, yPos + stackOffset, zPos);
    }


    /**
     * Updates the visual appearance (face-up/face-down) of a card mesh
     * by animating its rotationQuaternion.
     * @param card The logical card object.
     * @param forceImmediate If true, applies the change instantly without animation.
     */
    public updateCardVisual(card: Card, forceImmediate: boolean = false): void {
        const cardId = card.getUniqueId();
        const cardMesh = this.cardMeshes.get(cardId);
        const logicalFaceUp = card.isFaceUp(); // Get the desired final state
        const targetQuaternion = logicalFaceUp ? CardVisualizer.FACE_UP_FLAT_QUAT : CardVisualizer.FACE_DOWN_FLAT_QUAT;

        console.log(`%c[CardViz] updateCardVisual called for ${card.toString()}. Logical faceUp=${logicalFaceUp}. Force Immediate=${forceImmediate}`, 'color: #BA55D3');

        if (!cardMesh) { console.warn(`[CardViz] Cannot update visual for card ${card.toString()}, mesh not found.`); return; }

        // Ensure rotationQuaternion exists
        if (!cardMesh.rotationQuaternion) {
            console.log(`%c[CardViz]   -> Initializing rotationQuaternion from Euler rotation ${cardMesh.rotation.toString()}`, 'color: #BA55D3');
            cardMesh.rotationQuaternion = Quaternion.FromEulerVector(cardMesh.rotation);
        }

        const currentQuaternion = cardMesh.rotationQuaternion;
        console.log(`%c[CardViz]   -> Current Quat: ${currentQuaternion.toString()}`, 'color: #BA55D3');
        console.log(`%c[CardViz]   -> Target Quat: ${targetQuaternion.toString()}`, 'color: #BA55D3');

        // Check if the current rotation is already close to the target
        const needsRotation = !currentQuaternion.equalsWithEpsilon(targetQuaternion, CardVisualizer.QUATERNION_EPSILON);

        if (needsRotation && !forceImmediate) {
            console.log(`%c[CardViz]   -> Calling animateFlip to target Quaternion.`, 'color: #BA55D3; font-weight: bold;');
            this.animateFlip(cardMesh, targetQuaternion);
        } else if (needsRotation && forceImmediate) {
            console.log(`%c[CardViz]   -> Setting rotationQuaternion directly (forceImmediate).`, 'color: #BA55D3; font-weight: bold;');
            cardMesh.rotationQuaternion = targetQuaternion.clone();
        } else {
            console.log(`%c[CardViz]   -> No rotation needed. Visual state matches logical state.`, 'color: #BA55D3');
            // Ensure it's exactly the target value if very close but not equal
            if (!currentQuaternion.equals(targetQuaternion)) {
                 cardMesh.rotationQuaternion = targetQuaternion.clone();
            }
        }
    }

    public clearTable(): void {
        console.log("[CardViz] Clearing table visuals.");
        this.animationInProgress = false; // Reset flag
        // Stop animations on all meshes before disposing
        this.cardMeshes.forEach(mesh => { this.scene.stopAnimation(mesh); mesh.dispose(); });
        this.cardMeshes.clear();
    }

    // --- FIX: Added return type ---
    public isAnimationInProgress(): boolean {
        // Check internal flag first (set during animations)
        if (this.animationInProgress) return true;
        // As a fallback, check if any card meshes still have active animatables
        for (const mesh of this.cardMeshes.values()) {
            if (this.scene.getAllAnimatablesByTarget(mesh).length > 0) {
                return true;
            }
        }
        return false;
    }

    // --- Animation Implementations ---

    /** Animates card dealing (Position and Quaternion Rotation). */
    private animateCardDealing(mesh: Mesh, targetPos: Vector3, targetQuat: Quaternion, card: Card): void {
        const cardId = card.getUniqueId();
        console.log(`%c[CardViz] >>> animateCardDealing START for ${card.toString()} (Mesh: ${mesh.name})`, 'color: #1E90FF');
        console.log(`%c[CardViz]     Target Pos: ${targetPos.toString()}`, 'color: #1E90FF');
        console.log(`%c[CardViz]     Target Quat: ${targetQuat.toString()}`, 'color: #1E90FF; font-weight: bold;');

        this.animationInProgress = true;
        const slideFrames = CardVisualizer.DEAL_SLIDE_DURATION_MS / 1000 * CardVisualizer.FPS;
        const rotationFrames = CardVisualizer.DEAL_ROTATION_DURATION_MS / 1000 * CardVisualizer.FPS;

        const slideEase = new CubicEase(); slideEase.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
        const rotationEase = new QuadraticEase(); rotationEase.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

        // Ensure quaternion exists, start from Identity (standing up)
        const startQuat = mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : Quaternion.Identity();
        if (!mesh.rotationQuaternion) mesh.rotationQuaternion = startQuat.clone();
        console.log(`%c[CardViz]     Start Quat: ${startQuat.toString()}`, 'color: #FF4500; font-weight: bold;');

        // Position animation
        const posAnim = new Animation("dealPosAnim", "position", CardVisualizer.FPS, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
        posAnim.setKeys([{ frame: 0, value: mesh.position.clone() }, { frame: slideFrames, value: targetPos }]);
        posAnim.setEasingFunction(slideEase);

        // --- Animate rotationQuaternion ---
        const rotQuatAnim = new Animation("dealRotQuatAnim", "rotationQuaternion", CardVisualizer.FPS, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CONSTANT);
        rotQuatAnim.setKeys([{ frame: 0, value: startQuat }, { frame: rotationFrames, value: targetQuat }]);
        rotQuatAnim.setEasingFunction(rotationEase);

        // Determine the longest duration needed
        const overallFrames = Math.max(slideFrames, rotationFrames);
        console.log(`%c[CardViz]     Starting Babylon direct animation (Pos, Quat) for ${overallFrames.toFixed(0)} frames.`, 'color: #1E90FF');

        // Animate Position and Quaternion Rotation
        this.scene.beginDirectAnimation(mesh, [posAnim, rotQuatAnim], 0, overallFrames, false, 1,
            () => { // Animation Complete Callback
                console.log(`%c[CardViz] <<< Deal Animation CALLBACK START for ${card.toString()} (Mesh: ${mesh.name})`, 'color: #1E90FF; font-weight: bold;');
                console.log(`%c[CardViz]       Mesh rotationQuaternion BEFORE final set: ${mesh.rotationQuaternion?.toString()}`, 'color: #1E90FF');

                // --- Set Final State ---
                mesh.position = targetPos;
                // Ensure final rotationQuaternion is exactly the target
                mesh.rotationQuaternion = targetQuat.clone();
                console.log(`%c[CardViz]       Mesh rotationQuaternion AFTER final set: ${mesh.rotationQuaternion?.toString()}`, 'color: #1E90FF');

                // --- Verification (Optional but good practice) ---
                const logicalCard = this.blackjackGame.getPlayerHand().find(c => c.getUniqueId() === cardId) || this.blackjackGame.getDealerHand().find(c => c.getUniqueId() === cardId);
                if (logicalCard) {
                    const expectedQuat = logicalCard.isFaceUp() ? CardVisualizer.FACE_UP_FLAT_QUAT : CardVisualizer.FACE_DOWN_FLAT_QUAT;
                    if (!mesh.rotationQuaternion.equalsWithEpsilon(expectedQuat, CardVisualizer.QUATERNION_EPSILON)) {
                        console.warn(`%c[CardViz]       POST-ANIMATION MISMATCH! Mesh Quat ${mesh.rotationQuaternion.toString()} does not match expected ${expectedQuat.toString()} for logical state FaceUp=${logicalCard.isFaceUp()}. Forcing correction.`, 'color: red; font-weight: bold;');
                        mesh.rotationQuaternion = expectedQuat.clone(); // Force correction based on current logical state
                    } else {
                         console.log(`%c[CardViz]       Verification OK: Mesh Quaternion matches expected state.`, 'color: #1E90FF');
                    }
                } else {
                     console.warn(`[CardViz] Could not find logical card ${cardId} after deal animation to verify final rotation.`);
                }
                // --- End Verification ---

                this.animationInProgress = false; // Reset animation flag
                 console.log(`%c[CardViz]       Set animationInProgress = false`, 'color: #1E90FF');

                // Trigger the callback to notify GameController -> GameActions
                if (this.onAnimationCompleteCallback) {
                    console.log(`%c[CardViz]       Executing onAnimationCompleteCallback (async).`, 'color: #1E90FF');
                    setTimeout(() => { if (this.onAnimationCompleteCallback) this.onAnimationCompleteCallback(); }, 0);
                } else {
                    console.warn("[CardViz] Deal animation finished, but no onAnimationCompleteCallback set.");
                }
                 console.log(`%c[CardViz] <<< Deal Animation CALLBACK END for ${card.toString()} (Mesh: ${mesh.name})`, 'color: #1E90FF; font-weight: bold;');
            }
        );
    }

    /** Animates flipping the card using Quaternion rotation. */
     private animateFlip(mesh: Mesh, targetQuat: Quaternion): void {
        console.log(`%c[CardViz] >>> animateFlip START for mesh ${mesh.name}. Target Quat=${targetQuat.toString()}`, 'color: orange');
        this.animationInProgress = true;
        const durationFrames = CardVisualizer.FLIP_DURATION_MS / 1000 * CardVisualizer.FPS;
        const easing = new QuadraticEase(); easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

        // Ensure quaternion exists, start from current rotation
        const startQuat = mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : CardVisualizer.FACE_UP_FLAT_QUAT; // Assume face up if undefined
        if (!mesh.rotationQuaternion) mesh.rotationQuaternion = startQuat.clone();

        console.log(`%c[CardViz]     Start Quat=${startQuat.toString()}`, 'color: orange');

        // Animate rotationQuaternion
        const rotQuatAnim = new Animation("flipRotQuatAnim", "rotationQuaternion", CardVisualizer.FPS, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CONSTANT);
        rotQuatAnim.setKeys([{ frame: 0, value: startQuat }, { frame: durationFrames, value: targetQuat }]);
        rotQuatAnim.setEasingFunction(easing);

        console.log(`%c[CardViz]     Starting Babylon direct animation (Quat) for ${durationFrames.toFixed(0)} frames.`, 'color: orange');
        this.scene.beginDirectAnimation(mesh, [rotQuatAnim], 0, durationFrames, false, 1, () => { // Animation Complete Callback
             console.log(`%c[CardViz] <<< Flip Animation CALLBACK START for mesh ${mesh.name}`, 'color: orange; font-weight: bold;');
             console.log(`%c[CardViz]       Mesh rotationQuaternion BEFORE final set: ${mesh.rotationQuaternion?.toString()}`, 'color: orange');

            // --- CRITICAL: Ensure final state is EXACTLY correct ---
            mesh.rotationQuaternion = targetQuat.clone();
            console.log(`%c[CardViz]       Mesh rotationQuaternion AFTER final set: ${mesh.rotationQuaternion?.toString()}`, 'color: orange');

            this.animationInProgress = false; // Reset animation flag
            console.log(`%c[CardViz]       Set animationInProgress = false`, 'color: orange');

            // Trigger the callback to notify GameController -> GameActions
            if (this.onAnimationCompleteCallback) {
                 console.log(`%c[CardViz]       Executing onAnimationCompleteCallback (async).`, 'color: orange');
                 setTimeout(() => { if (this.onAnimationCompleteCallback) this.onAnimationCompleteCallback(); }, 0);
            } else {
                 console.warn("[CardViz] Flip animation finished, but no onAnimationCompleteCallback set.");
            }
            console.log(`%c[CardViz] <<< Flip Animation CALLBACK END for mesh ${mesh.name}`, 'color: orange; font-weight: bold;');
        });
    }

    // --- FIX: Added return type ---
     private animateVector3(mesh: Mesh, property: "position", targetValue: Vector3, durationMs: number, easing?: EasingFunction, triggerCompletionCallback: boolean = true): void {
        // Only allow 'position'
        if (property !== 'position') {
            console.error(`[CardViz] animateVector3 called with unsupported property: ${property}. Only 'position' is allowed.`);
            return; // --- FIX: Added return for void function ---
        }

        this.animationInProgress = true; // Set flag when starting animation
        const durationFrames = durationMs / 1000 * CardVisualizer.FPS;
        const effectiveEasing = easing ?? new CubicEase();
        if (!easing) effectiveEasing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT); // Default easing if none provided

        const anim = new Animation(
            `${property}Anim_${mesh.name}_${Date.now()}`, // Unique animation name
            property,
            CardVisualizer.FPS,
            Animation.ANIMATIONTYPE_VECTOR3,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        let startValue = mesh.position.clone();

        // Avoid starting animation if already at target
        if (startValue.equalsWithEpsilon(targetValue, 0.001)) {
             this.animationInProgress = false; // Reset flag
             // Still trigger callback if requested, as the "action" is complete
             if (triggerCompletionCallback && this.onAnimationCompleteCallback) {
                 setTimeout(() => { if (this.onAnimationCompleteCallback) this.onAnimationCompleteCallback(); }, 0);
             }
             return; // --- FIX: Added return for void function ---
        }

        anim.setKeys([{ frame: 0, value: startValue }, { frame: durationFrames, value: targetValue }]);
        anim.setEasingFunction(effectiveEasing);

        this.scene.beginDirectAnimation(mesh, [anim], 0, durationFrames, false, 1, () => { // Animation Complete Callback
            // --- CRITICAL: Ensure final state is EXACTLY correct ---
            mesh.position = targetValue;

            this.animationInProgress = false; // Reset flag when animation truly finishes
            if (triggerCompletionCallback && this.onAnimationCompleteCallback) {
                 setTimeout(() => { if (this.onAnimationCompleteCallback) this.onAnimationCompleteCallback(); }, 0);
            }
        });
    }


    // --- Material Creation ---
    // --- FIX: Added return type ---
    private getFaceTextureUrl(card: Card): string {
        const suitStr = card.getSuit().toUpperCase();
        const rankVal = card.getRankValueForTexture();
        return `${CardVisualizer.TEXTURE_BASE_PATH}${suitStr} ${rankVal}.png`;
    }

    // --- FIX: Added return type ---
    private createCardMaterialInternal(card: Card | null): StandardMaterial {
        const isFace = card !== null;
        const cacheKey = isFace ? this.getFaceTextureUrl(card!) : "cardBackMaterial";
        const fallbackColor = isFace ? CardVisualizer.FALLBACK_FACE_COLOR : CardVisualizer.FALLBACK_BACK_COLOR;

        // Use separate caches for face/back/side
        if (!isFace) { // Back material
            if (this.cardBackMaterial) return this.cardBackMaterial;
        } else { // Face material
            if (this.cardFaceMaterials.has(cacheKey)) {
                return this.cardFaceMaterials.get(cacheKey)!;
            }
        }

        const materialName = cacheKey.replace(/[^a-zA-Z0-9]/g, '_');
        const material = new StandardMaterial(materialName, this.scene);
        material.backFaceCulling = false;
        material.specularColor = new Color3(0.1, 0.1, 0.1);
        material.diffuseColor = fallbackColor; // Fallback first

        try {
            if (isFace) {
                const textureUrl = cacheKey;
                const texture = new Texture(textureUrl, this.scene, false, true, Texture.TRILINEAR_SAMPLINGMODE,
                    () => { // onLoad
                        material.diffuseTexture = texture;
                        material.useAlphaFromDiffuseTexture = true;
                        material.diffuseColor = Color3.White(); // Reset tint
                    },
                    (message, exception) => { // onError
                        console.error(`%c[CardViz] ERROR loading FACE texture ${textureUrl}: ${message}`, 'color: red', exception);
                    }
                );
                texture.hasAlpha = true;
                this.cardFaceMaterials.set(cacheKey, material); // Cache face material
            } else { // Back material
                material.diffuseColor = Color3.White(); // No tint for back
                const textureSize = { width: 256, height: 358 };
                const cornerRadius = 30;
                const texture = new DynamicTexture("dynamicCardBackTexture", textureSize, this.scene, true);
                const ctx = texture.getContext();
                ctx.clearRect(0, 0, textureSize.width, textureSize.height);
                ctx.beginPath();
                ctx.moveTo(cornerRadius, 0); ctx.lineTo(textureSize.width - cornerRadius, 0);
                ctx.arc(textureSize.width - cornerRadius, cornerRadius, cornerRadius, -Math.PI/2, 0);
                ctx.lineTo(textureSize.width, textureSize.height - cornerRadius);
                ctx.arc(textureSize.width - cornerRadius, textureSize.height - cornerRadius, cornerRadius, 0, Math.PI/2);
                ctx.lineTo(cornerRadius, textureSize.height);
                ctx.arc(cornerRadius, textureSize.height - cornerRadius, cornerRadius, Math.PI/2, Math.PI);
                ctx.lineTo(0, cornerRadius);
                ctx.arc(cornerRadius, cornerRadius, cornerRadius, Math.PI, -Math.PI/2);
                ctx.closePath();
                ctx.fillStyle = "#B22222"; ctx.fill();
                ctx.strokeStyle = "#000000"; ctx.lineWidth = 4; ctx.stroke();
                (ctx as any).imageSmoothingEnabled = true;
                texture.update(false);
                material.diffuseTexture = texture;
                this.cardBackMaterial = material; // Cache back material
            }
            return material; // --- FIX: Added return ---
        } catch (error) {
            console.error(`[CardViz] CRITICAL error during material creation for ${cacheKey}:`, error);
            material?.dispose();
            const errorMatName = "errorMat_" + materialName;
            let errorMat = this.scene.getMaterialByName(errorMatName) as StandardMaterial;
            if (!errorMat) {
                errorMat = new StandardMaterial(errorMatName, this.scene);
                errorMat.diffuseColor = Color3.Magenta();
                errorMat.emissiveColor = Color3.Magenta();
            }
             // Cache the error material to avoid repeated creation attempts
             if (isFace) this.cardFaceMaterials.set(cacheKey, errorMat);
             else this.cardBackMaterial = errorMat;
            return errorMat; // --- FIX: Added return ---
        }
    }
    // --- End Material Creation ---
}
