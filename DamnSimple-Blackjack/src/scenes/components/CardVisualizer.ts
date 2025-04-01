// src/scenes/components/cardvisualizer.ts
// Use centralized constants
import { Scene, Vector3, MeshBuilder, StandardMaterial, Color3, Texture, DynamicTexture,
    Mesh, Animation, EasingFunction, CubicEase, QuadraticEase, SineEase, Material, BackEase, MultiMaterial, Vector4, SubMesh, Quaternion } from "@babylonjs/core";
import { Card } from "../../game/Card";
import { BlackjackGame } from "../../game/BlackjackGame";
import { Constants } from "../../Constants"; // *** IMPORT Constants ***

export class CardVisualizer {
    private scene: Scene;
    private blackjackGame: BlackjackGame;
    private cardMeshes: Map<string, Mesh> = new Map();
    /** The X, Y, Z position where card deal animations originate. Y is calculated. */
    private animationOriginPosition: Vector3;
    private animationInProgress: boolean = false;
    private onAnimationCompleteCallback: (() => void) | null = null;

    // --- Constants Kept Local ---
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
    // Target Quaternions
    private static readonly FACE_UP_FLAT_QUAT = Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2);
    private static readonly FACE_DOWN_FLAT_QUAT = Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2).multiply(Quaternion.RotationAxis(Vector3.Up(), Math.PI));
    private static readonly QUATERNION_EPSILON = 0.001; // For comparisons

    // Material Cache / Singletons
    private materialCache: Map<string, StandardMaterial> = new Map();
    private cardBackMaterial: StandardMaterial | null = null;
    private cardSideMaterial: StandardMaterial | null = null;
    private cardFaceMaterials: Map<string, StandardMaterial> = new Map();

    constructor(scene: Scene, blackjackGame: BlackjackGame, deckPositionXZ: Vector3) {
        this.scene = scene;
        this.blackjackGame = blackjackGame;

        // *** Calculate the animation origin Y using constants ***
        // This assumes the dispenser center is slightly above where cards lie flat
        const animationOriginY = Constants.CARD_Y_POS + Constants.DECK_DISPENSER_Y_OFFSET;
        this.animationOriginPosition = new Vector3(deckPositionXZ.x, animationOriginY, deckPositionXZ.z);

        this.blackjackGame.addCardFlipCallback(
             "cardVisualizerFlipHandler",
             (card) => this.updateCardVisual(card, false) // Use flip animation
        );
        this.getCardBackMaterial(); // Pre-cache back
        this.getCardSideMaterial(); // Pre-cache side
        console.log("[CardViz] Initialized (Using Constants).");
        console.log(`[CardViz] Animation Origin (animationOriginPosition): ${this.animationOriginPosition.toString()}`);
    }

    public setOnAnimationCompleteCallback(callback: () => void): void {
        this.onAnimationCompleteCallback = callback;
    }

    // --- Material Getters (remain the same) ---
    public getCardBackMaterial(): StandardMaterial {
        if (!this.cardBackMaterial) {
            this.cardBackMaterial = this.createCardMaterialInternal(null);
        }
        return this.cardBackMaterial!;
    }

    public getCardSideMaterial(): StandardMaterial {
        if (!this.cardSideMaterial) {
             this.cardSideMaterial = new StandardMaterial("cardSideMat", this.scene);
             this.cardSideMaterial.diffuseColor = new Color3(0.85, 0.85, 0.85);
             this.cardSideMaterial.specularColor = new Color3(0.05, 0.05, 0.05);
        }
        return this.cardSideMaterial;
    }

    public getCardFaceMaterial(card: Card): StandardMaterial {
        const cacheKey = this.getFaceTextureUrl(card);
        if (!this.cardFaceMaterials.has(cacheKey)) {
            this.cardFaceMaterials.set(cacheKey, this.createCardMaterialInternal(card));
        }
        return this.cardFaceMaterials.get(cacheKey)!;
    }
    // --- End Material Getters ---

    // --- Dimension Getters (Use Constants) ---
    public getAnimationOriginY(): number {
        return this.animationOriginPosition.y;
    }

    public getCardWidth(): number {
        return Constants.CARD_WIDTH;
    }

    public getCardHeight(): number {
        return Constants.CARD_HEIGHT;
    }

    public getCardDepth(): number {
        return Constants.CARD_DEPTH;
    }

    public getCardCornerRadius(): number {
        return Constants.CARD_CORNER_RADIUS;
    }
    // --- End Dimension Getters ---


    public createCardMesh(card: Card, index: number, isPlayer: boolean, faceUp: boolean): void {
        const target = isPlayer ? 'Player' : 'Dealer';
        console.log(`%c[CardViz] createCardMesh called for ${card.toString()} to ${target}. Index: ${index}, FaceUp (target): ${faceUp}`, 'color: #20B2AA');

        const cardId = card.getUniqueId();
        if (this.cardMeshes.has(cardId)) {
            console.warn(`[CardViz] Card mesh ${cardId} already exists. Disposing and recreating.`);
            this.cardMeshes.get(cardId)?.dispose();
            this.cardMeshes.delete(cardId);
        }

        const backUV = new Vector4(0, 0, 1, 1);
        const faceUV = new Vector4(0, 0, 1, 1);
        const sideUV = new Vector4(0, 0, 0.01, 0.01);
        const boxFaceUVs = [backUV, faceUV, sideUV, sideUV, sideUV, sideUV];

        console.log(`%c[CardViz]   -> Creating BOX mesh.`, 'color: green;');
        const cardMesh = MeshBuilder.CreateBox(
            `card_${cardId}`, {
                width: Constants.CARD_WIDTH, // Use Constant
                height: Constants.CARD_HEIGHT, // Use Constant
                depth: Constants.CARD_DEPTH, // Use Constant
                faceUV: boxFaceUVs
            }, this.scene
        );

        // *** Create card mesh at the Animation Origin Position ***
        cardMesh.position = this.animationOriginPosition.clone();
        cardMesh.rotationQuaternion = Quaternion.Identity();
        console.log(`%c[CardViz]   -> Mesh created at animation origin: ${cardMesh.position.toString()}. Initial rotationQuaternion: ${cardMesh.rotationQuaternion.toString()}`, 'color: #FF4500; font-weight: bold;');

        // Apply MultiMaterial (remains the same)
        const multiMat = new MultiMaterial(`multiMat_${cardId}`, this.scene);
        multiMat.subMaterials.push(this.getCardFaceMaterial(card)); // 0: Face
        multiMat.subMaterials.push(this.getCardBackMaterial());     // 1: Back
        multiMat.subMaterials.push(this.getCardSideMaterial());     // 2: Side
        cardMesh.material = multiMat;

        // Assign SubMeshes (remains the same, uses local indices)
        console.log(`%c[CardViz]   -> Applying SubMesh assignments (Face[${CardVisualizer.MATIDX_FACE}] on -Z, Back[${CardVisualizer.MATIDX_BACK}] on +Z).`, 'color: green; font-weight: bold;');
        cardMesh.subMeshes = [];
        const verticesCount = cardMesh.getTotalVertices();
        new SubMesh(CardVisualizer.MATIDX_BACK, 0, verticesCount, 0, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_FACE, 0, verticesCount, 6, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 12, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 18, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 24, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 30, 6, cardMesh);

        this.cardMeshes.set(cardId, cardMesh);
        console.log(`%c[CardViz]   -> Mesh added to cardMeshes map.`, 'color: #20B2AA');

        // Start Deal Animation (uses Constants for duration/fps)
        this.animateCardDealing(cardMesh, index, isPlayer, faceUp, card);
    }

    private createCardMeshInstant(card: Card, index: number, isPlayer: boolean): void {
        const cardId = card.getUniqueId();
        console.log(`%c[CardViz] createCardMeshInstant for ${card.toString()}. IsPlayer: ${isPlayer}, Index: ${index}, FaceUp: ${card.isFaceUp()}`, 'color: #4682B4');

        const backUV = new Vector4(0, 0, 1, 1);
        const faceUV = new Vector4(0, 0, 1, 1);
        const sideUV = new Vector4(0, 0, 0.01, 0.01);
        const boxFaceUVs = [backUV, faceUV, sideUV, sideUV, sideUV, sideUV];

        const cardMesh = MeshBuilder.CreateBox(
            `card_${cardId}`, {
                width: Constants.CARD_WIDTH, // Use Constant
                height: Constants.CARD_HEIGHT, // Use Constant
                depth: Constants.CARD_DEPTH, // Use Constant
                faceUV: boxFaceUVs
            }, this.scene
        );

        const handSize = this.getHandSize(isPlayer);
        const position = this.calculateCardPosition(index, isPlayer, handSize);
        cardMesh.position = position;

        const targetQuaternion = card.isFaceUp() ? CardVisualizer.FACE_UP_FLAT_QUAT : CardVisualizer.FACE_DOWN_FLAT_QUAT;
        cardMesh.rotationQuaternion = targetQuaternion.clone();
        console.log(`%c[CardViz]   -> Instant Position: ${position.toString()}`, 'color: #4682B4');
        console.log(`%c[CardViz]   -> Instant rotationQuaternion: ${cardMesh.rotationQuaternion.toString()}`, 'color: #4682B4');

        // Apply MultiMaterial (remains the same)
        const multiMat = new MultiMaterial(`multiMat_${cardId}_instant`, this.scene);
        multiMat.subMaterials.push(this.getCardFaceMaterial(card));
        multiMat.subMaterials.push(this.getCardBackMaterial());
        multiMat.subMaterials.push(this.getCardSideMaterial());
        cardMesh.material = multiMat;

        // Assign SubMeshes (remains the same)
        console.log(`%c[CardViz]   -> Applying SubMesh assignments (Instant).`, 'color: green; font-weight: bold;');
        cardMesh.subMeshes = [];
        const verticesCount = cardMesh.getTotalVertices();
        new SubMesh(CardVisualizer.MATIDX_BACK, 0, verticesCount, 0, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_FACE, 0, verticesCount, 6, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 12, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 18, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 24, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 30, 6, cardMesh);

        this.cardMeshes.set(cardId, cardMesh);
    }

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
                    this.createCardMeshInstant(card, index, isPlayer);
                } else {
                    const targetPos = this.calculateCardPosition(index, isPlayer, handSize);
                    const targetQuat = card.isFaceUp() ? CardVisualizer.FACE_UP_FLAT_QUAT : CardVisualizer.FACE_DOWN_FLAT_QUAT;

                    if (!cardMesh.position.equalsWithEpsilon(targetPos)) {
                        cardMesh.position = targetPos;
                    }
                    if (!cardMesh.rotationQuaternion) cardMesh.rotationQuaternion = Quaternion.Identity();
                    if (!cardMesh.rotationQuaternion.equalsWithEpsilon(targetQuat, CardVisualizer.QUATERNION_EPSILON)) {
                        cardMesh.rotationQuaternion = targetQuat.clone();
                    }

                    if (isRestoring) {
                        console.log(`%c[CardViz]   -> Restored mesh position/rotation for ${card.toString()}.`, 'color: #4682B4');
                        console.log(`%c[CardViz]     -> Pos: ${targetPos.toString()}, Quat: ${targetQuat.toString()}`, 'color: #4682B4');
                    }
                }
            });
        });

        // Cleanup (remains the same)
        this.cardMeshes.forEach((mesh, cardId) => {
            if (!currentCardIds.has(cardId)) {
                 console.log(`%c[CardViz]   -> Disposing mesh for removed card: ${cardId}`, 'color: #4682B4');
                this.scene.stopAnimation(mesh);
                mesh.dispose();
                this.cardMeshes.delete(cardId);
            }
        });
    }

    private repositionHandCards(isPlayer: boolean, newHandSize: number): void {
        const hand = isPlayer ? this.blackjackGame.getPlayerHand() : this.blackjackGame.getDealerHand();
        const target = isPlayer ? 'Player' : 'Dealer';
        console.log(`%c[CardViz] repositionHandCards for ${target}. New Size: ${newHandSize}`, 'color: #FFA500');

        hand.forEach((card, index) => {
            const cardMesh = this.cardMeshes.get(card.getUniqueId());
            if (cardMesh && index < newHandSize - 1) {
                const newPosition = this.calculateCardPosition(index, isPlayer, newHandSize);
                console.log(`%c[CardViz]   -> Repositioning ${card.toString()} (Index ${index}) to ${newPosition.toString()}`, 'color: #FFA500');
                if (!cardMesh.position.equalsWithEpsilon(newPosition, 0.01)) {
                    const ease = new QuadraticEase();
                    ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
                    console.log(`%c[CardViz]     -> Using QuadraticEaseInOut for repositioning.`, 'color: #FFA500');

                    this.animateVector3(
                        cardMesh,
                        "position",
                        newPosition,
                        Constants.REPOSITION_DURATION_MS, // Use Constant
                        ease,
                        false
                    );
                }
            } else if (!cardMesh && index < newHandSize - 1) {
                 console.warn(`[CardViz] Cannot reposition existing card ${card.toString()}, mesh not found in map during repositioning.`);
            }
        });
    }

    // Uses Constants for Z pos, Y pos, spacing, stack offset
    private calculateCardPosition(index: number, isPlayer: boolean, handSize: number): Vector3 {
        const zPos = isPlayer ? Constants.PLAYER_HAND_Z : Constants.DEALER_HAND_Z;
        const yPos = Constants.CARD_Y_POS;
        const stackOffset = (index * Constants.CARD_STACK_OFFSET);

        const totalWidth = (handSize - 1) * Constants.CARD_SPACING;
        const startX = -(totalWidth / 2);
        const xPos = startX + (index * Constants.CARD_SPACING);

        return new Vector3(xPos, yPos + stackOffset, zPos);
    }


    public updateCardVisual(card: Card, forceImmediate: boolean = false): void {
        const cardId = card.getUniqueId();
        const cardMesh = this.cardMeshes.get(cardId);
        const logicalFaceUp = card.isFaceUp();
        const targetQuaternion = logicalFaceUp ? CardVisualizer.FACE_UP_FLAT_QUAT : CardVisualizer.FACE_DOWN_FLAT_QUAT;

        console.log(`%c[CardViz] updateCardVisual called for ${card.toString()}. Logical faceUp=${logicalFaceUp}. Force Immediate=${forceImmediate}`, 'color: #BA55D3');

        if (!cardMesh) { console.warn(`[CardViz] Cannot update visual for card ${card.toString()}, mesh not found.`); return; }

        if (!cardMesh.rotationQuaternion) {
            console.log(`%c[CardViz]   -> Initializing rotationQuaternion from Euler rotation ${cardMesh.rotation.toString()}`, 'color: #BA55D3');
            cardMesh.rotationQuaternion = Quaternion.FromEulerVector(cardMesh.rotation);
        }

        const currentQuaternion = cardMesh.rotationQuaternion;
        console.log(`%c[CardViz]   -> Current Quat: ${currentQuaternion.toString()}`, 'color: #BA55D3');
        console.log(`%c[CardViz]   -> Target Quat: ${targetQuaternion.toString()}`, 'color: #BA55D3');

        const needsRotation = !currentQuaternion.equalsWithEpsilon(targetQuaternion, CardVisualizer.QUATERNION_EPSILON);

        if (needsRotation && !forceImmediate) {
            console.log(`%c[CardViz]   -> Calling animateFlip to target Quaternion.`, 'color: #BA55D3; font-weight: bold;');
            this.animateFlip(cardMesh, targetQuaternion);
        } else if (needsRotation && forceImmediate) {
            console.log(`%c[CardViz]   -> Setting rotationQuaternion directly (forceImmediate).`, 'color: #BA55D3; font-weight: bold;');
            cardMesh.rotationQuaternion = targetQuaternion.clone();
        } else {
            console.log(`%c[CardViz]   -> No rotation needed. Visual state matches logical state.`, 'color: #BA55D3');
            if (!currentQuaternion.equals(targetQuaternion)) {
                 cardMesh.rotationQuaternion = targetQuaternion.clone();
            }
        }
    }

    public clearTable(): void {
        console.log("[CardViz] Clearing table visuals.");
        this.animationInProgress = false;
        this.cardMeshes.forEach(mesh => { this.scene.stopAnimation(mesh); mesh.dispose(); });
        this.cardMeshes.clear();
    }

    public isAnimationInProgress(): boolean {
        if (this.animationInProgress) return true;
        for (const mesh of this.cardMeshes.values()) {
            if (this.scene.getAllAnimatablesByTarget(mesh).length > 0) {
                return true;
            }
        }
        return false;
    }

    // --- Animation Implementations (Use Constants for duration/fps) ---

    private animateCardDealing(mesh: Mesh, index: number, isPlayer: boolean, faceUp: boolean, card: Card): void {
        const cardId = card.getUniqueId();
        const targetOwner = isPlayer ? 'Player' : 'Dealer';
        const finalHandSize = this.getHandSize(isPlayer);

        console.log(`%c[CardViz] >>> animateCardDealing START for ${card.toString()} (Mesh: ${mesh.name}) to ${targetOwner}`, 'color: #1E90FF');
        console.log(`%c[CardViz]     Target Index: ${index}, Final Hand Size: ${finalHandSize}, Target FaceUp: ${faceUp}`, 'color: #1E90FF');

        const targetPos = this.calculateCardPosition(index, isPlayer, finalHandSize);
        const targetQuat = faceUp ? CardVisualizer.FACE_UP_FLAT_QUAT : CardVisualizer.FACE_DOWN_FLAT_QUAT;

        console.log(`%c[CardViz]     Target Pos (New Card): ${targetPos.toString()}`, 'color: #1E90FF');
        console.log(`%c[CardViz]     Target Quat (New Card): ${targetQuat.toString()}`, 'color: #1E90FF; font-weight: bold;');

        this.animationInProgress = true;
        const slideFrames = Constants.DEAL_SLIDE_DURATION_MS / 1000 * Constants.FPS;
        const rotationFrames = Constants.DEAL_ROTATION_DURATION_MS / 1000 * Constants.FPS;

        const slideEase = new CubicEase(); slideEase.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
        const rotationEase = new QuadraticEase(); rotationEase.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

        const startQuat = mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : Quaternion.Identity();
        if (!mesh.rotationQuaternion) mesh.rotationQuaternion = startQuat.clone();
        console.log(`%c[CardViz]     Start Quat (New Card): ${startQuat.toString()}`, 'color: #FF4500; font-weight: bold;');

        console.log(`%c[CardViz]     Calling repositionHandCards for ${targetOwner} BEFORE starting new card animation.`, 'color: #FFA500; font-weight: bold;');
        this.repositionHandCards(isPlayer, finalHandSize);

        const posAnim = new Animation("dealPosAnim", "position", Constants.FPS, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
        posAnim.setKeys([{ frame: 0, value: mesh.position.clone() }, { frame: slideFrames, value: targetPos }]);
        posAnim.setEasingFunction(slideEase);

        const rotQuatAnim = new Animation("dealRotQuatAnim", "rotationQuaternion", Constants.FPS, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CONSTANT);
        rotQuatAnim.setKeys([{ frame: 0, value: startQuat }, { frame: rotationFrames, value: targetQuat }]);
        rotQuatAnim.setEasingFunction(rotationEase);

        const overallFrames = Math.max(slideFrames, rotationFrames);
        console.log(`%c[CardViz]     Starting Babylon direct animation (Pos, Quat) for NEW CARD (${mesh.name}) for ${overallFrames.toFixed(0)} frames.`, 'color: #1E90FF');

        this.scene.beginDirectAnimation(mesh, [posAnim, rotQuatAnim], 0, overallFrames, false, 1,
            () => { // Animation Complete Callback
                console.log(`%c[CardViz] <<< Deal Animation CALLBACK START for ${card.toString()} (Mesh: ${mesh.name})`, 'color: #1E90FF; font-weight: bold;');
                console.log(`%c[CardViz]       Mesh rotationQuaternion BEFORE final set: ${mesh.rotationQuaternion?.toString()}`, 'color: #1E90FF');

                mesh.position = targetPos;
                mesh.rotationQuaternion = targetQuat.clone();
                console.log(`%c[CardViz]       Mesh rotationQuaternion AFTER final set: ${mesh.rotationQuaternion?.toString()}`, 'color: #1E90FF');

                // Verification
                const logicalCard = this.blackjackGame.getPlayerHand().find(c => c.getUniqueId() === cardId) || this.blackjackGame.getDealerHand().find(c => c.getUniqueId() === cardId);
                if (logicalCard) {
                    const expectedQuat = logicalCard.isFaceUp() ? CardVisualizer.FACE_UP_FLAT_QUAT : CardVisualizer.FACE_DOWN_FLAT_QUAT;
                    if (!mesh.rotationQuaternion.equalsWithEpsilon(expectedQuat, CardVisualizer.QUATERNION_EPSILON)) {
                        console.warn(`%c[CardViz]       POST-ANIMATION MISMATCH! Mesh Quat ${mesh.rotationQuaternion.toString()} does not match expected ${expectedQuat.toString()} for logical state FaceUp=${logicalCard.isFaceUp()}. Forcing correction.`, 'color: red; font-weight: bold;');
                        mesh.rotationQuaternion = expectedQuat.clone();
                    } else {
                         console.log(`%c[CardViz]       Verification OK: Mesh Quaternion matches expected state.`, 'color: #1E90FF');
                    }
                } else {
                     console.warn(`[CardViz] Could not find logical card ${cardId} after deal animation to verify final rotation.`);
                }

                this.animationInProgress = false;
                console.log(`%c[CardViz]       Set animationInProgress = false`, 'color: #1E90FF');

                if (this.onAnimationCompleteCallback) {
                    console.log(`%c[CardViz]       Executing onAnimationCompleteCallback (async).`, 'color: #1E90FF');
                    setTimeout(() => {
                        if (!this.isAnimationInProgress() && this.onAnimationCompleteCallback) {
                             console.log(`%c[CardViz]         Callback execution confirmed.`, 'color: #1E90FF');
                             this.onAnimationCompleteCallback();
                        } else {
                            console.warn(`[CardViz]         Callback skipped: Another animation started or callback became null.`);
                        }
                    }, 0);
                } else {
                    console.warn("[CardViz] Deal animation finished, but no onAnimationCompleteCallback set.");
                }
                 console.log(`%c[CardViz] <<< Deal Animation CALLBACK END for ${card.toString()} (Mesh: ${mesh.name})`, 'color: #1E90FF; font-weight: bold;');
            }
        );
    }

     private animateFlip(mesh: Mesh, targetQuat: Quaternion): void {
        console.log(`%c[CardViz] >>> animateFlip START for mesh ${mesh.name}. Target Quat=${targetQuat.toString()}`, 'color: orange');
        this.animationInProgress = true;
        const durationFrames = Constants.FLIP_DURATION_MS / 1000 * Constants.FPS; // Use Constant
        const easing = new QuadraticEase(); easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

        const startQuat = mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : CardVisualizer.FACE_UP_FLAT_QUAT;
        if (!mesh.rotationQuaternion) mesh.rotationQuaternion = startQuat.clone();

        console.log(`%c[CardViz]     Start Quat=${startQuat.toString()}`, 'color: orange');

        const rotQuatAnim = new Animation("flipRotQuatAnim", "rotationQuaternion", Constants.FPS, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CONSTANT);
        rotQuatAnim.setKeys([{ frame: 0, value: startQuat }, { frame: durationFrames, value: targetQuat }]);
        rotQuatAnim.setEasingFunction(easing);

        console.log(`%c[CardViz]     Starting Babylon direct animation (Quat) for ${durationFrames.toFixed(0)} frames.`, 'color: orange');
        this.scene.beginDirectAnimation(mesh, [rotQuatAnim], 0, durationFrames, false, 1, () => { // Animation Complete Callback
             console.log(`%c[CardViz] <<< Flip Animation CALLBACK START for mesh ${mesh.name}`, 'color: orange; font-weight: bold;');
             console.log(`%c[CardViz]       Mesh rotationQuaternion BEFORE final set: ${mesh.rotationQuaternion?.toString()}`, 'color: orange');

            mesh.rotationQuaternion = targetQuat.clone();
            console.log(`%c[CardViz]       Mesh rotationQuaternion AFTER final set: ${mesh.rotationQuaternion?.toString()}`, 'color: orange');

            this.animationInProgress = false;
            console.log(`%c[CardViz]       Set animationInProgress = false`, 'color: orange');

            if (this.onAnimationCompleteCallback) {
                 console.log(`%c[CardViz]       Executing onAnimationCompleteCallback (async).`, 'color: orange');
                 setTimeout(() => {
                     if (!this.isAnimationInProgress() && this.onAnimationCompleteCallback) {
                          console.log(`%c[CardViz]         Callback execution confirmed.`, 'color: orange');
                          this.onAnimationCompleteCallback();
                     } else {
                         console.warn(`[CardViz]         Callback skipped: Another animation started or callback became null.`);
                     }
                 }, 0);
            } else {
                 console.warn("[CardViz] Flip animation finished, but no onAnimationCompleteCallback set.");
            }
            console.log(`%c[CardViz] <<< Flip Animation CALLBACK END for mesh ${mesh.name}`, 'color: orange; font-weight: bold;');
        });
    }

     private animateVector3(mesh: Mesh, property: "position", targetValue: Vector3, durationMs: number, easing?: EasingFunction, triggerCompletionCallback: boolean = true): void {
        if (property !== 'position') {
            console.error(`[CardViz] animateVector3 called with unsupported property: ${property}. Only 'position' is allowed.`);
            return;
        }

        this.animationInProgress = true;
        const durationFrames = durationMs / 1000 * Constants.FPS; // Use Constant
        const effectiveEasing = easing ?? new CubicEase();
        if (!easing) effectiveEasing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

        const anim = new Animation(
            `${property}Anim_${mesh.name}_${Date.now()}`,
            property,
            Constants.FPS, // Use Constant
            Animation.ANIMATIONTYPE_VECTOR3,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        let startValue = mesh.position.clone();

        if (startValue.equalsWithEpsilon(targetValue, 0.001)) {
             console.log(`%c[CardViz] animateVector3 skipped for ${mesh.name} - already at target.`, 'color: gray');
             return;
        }

        anim.setKeys([{ frame: 0, value: startValue }, { frame: durationFrames, value: targetValue }]);
        anim.setEasingFunction(effectiveEasing);

        console.log(`%c[CardViz]     Starting Babylon direct animation (${property}) for ${mesh.name} for ${durationFrames.toFixed(0)} frames.`, 'color: gray');
        this.scene.beginDirectAnimation(mesh, [anim], 0, durationFrames, false, 1.0, () => {
            mesh.position = targetValue;
            if (triggerCompletionCallback) {
                 console.warn(`[CardViz] animateVector3 completed for ${mesh.name} with triggerCompletionCallback=true. This should likely be false for repositioning.`);
            }
        });
    }


    // --- Material Creation (Use Constants for path) ---
    private getFaceTextureUrl(card: Card): string {
        const suitStr = card.getSuit().toUpperCase();
        const rankVal = card.getRankValueForTexture();
        // *** USE Constant for base path ***
        return `${Constants.TEXTURE_BASE_PATH}${suitStr} ${rankVal}.png`;
    }

    private createCardMaterialInternal(card: Card | null): StandardMaterial {
        const isFace = card !== null;
        const cacheKey = isFace ? this.getFaceTextureUrl(card!) : "cardBackMaterial";
        // Use local fallback colors
        const fallbackColor = isFace ? CardVisualizer.FALLBACK_FACE_COLOR : CardVisualizer.FALLBACK_BACK_COLOR;

        // Cache check remains the same
        if (!isFace) {
            if (this.cardBackMaterial) return this.cardBackMaterial;
        } else {
            if (this.cardFaceMaterials.has(cacheKey)) {
                return this.cardFaceMaterials.get(cacheKey)!;
            }
        }

        const materialName = cacheKey.replace(/[^a-zA-Z0-9]/g, '_');
        const material = new StandardMaterial(materialName, this.scene);
        material.backFaceCulling = false;
        material.specularColor = new Color3(0.1, 0.1, 0.1);
        material.diffuseColor = fallbackColor;

        try {
            if (isFace) {
                // Face Material Logic (remains same)
                const textureUrl = cacheKey;
                const texture = new Texture(textureUrl, this.scene, false, true, Texture.TRILINEAR_SAMPLINGMODE,
                    () => {
                        material.diffuseTexture = texture;
                        material.useAlphaFromDiffuseTexture = true;
                        texture.hasAlpha = true;
                        material.diffuseColor = Color3.White();
                    },
                    (message, exception) => {
                        console.error(`%c[CardViz] ERROR loading FACE texture ${textureUrl}: ${message}`, 'color: red', exception);
                    }
                );
                texture.hasAlpha = true;
                this.cardFaceMaterials.set(cacheKey, material);
            } else {
                // Back Material Logic (remains same)
                console.log("[CardViz] Creating DYNAMIC card back material...");
                material.diffuseColor = Color3.White();
                const textureSize = { width: 256, height: 358 };
                const cornerRadius = 20;

                const texture = new DynamicTexture("dynamicCardBackTexture", textureSize, this.scene, true);
                texture.hasAlpha = true;

                const ctx = texture.getContext();
                const width = textureSize.width;
                const height = textureSize.height;

                ctx.clearRect(0, 0, width, height);
                ctx.beginPath();
                ctx.moveTo(cornerRadius, 0);
                ctx.lineTo(width - cornerRadius, 0);
                ctx.arc(width - cornerRadius, cornerRadius, cornerRadius, Math.PI * 1.5, Math.PI * 2);
                ctx.lineTo(width, height - cornerRadius);
                ctx.arc(width - cornerRadius, height - cornerRadius, cornerRadius, 0, Math.PI * 0.5);
                ctx.lineTo(cornerRadius, height);
                ctx.arc(cornerRadius, height - cornerRadius, cornerRadius, Math.PI * 0.5, Math.PI);
                ctx.lineTo(0, cornerRadius);
                ctx.arc(cornerRadius, cornerRadius, cornerRadius, Math.PI, Math.PI * 1.5);
                ctx.closePath();
                ctx.fillStyle = "#B22222";
                ctx.fill();
                const patternLineColor = "rgba(0, 0, 0, 0.15)";
                const patternLineWidth = 1;
                const patternSpacing = 8;
                ctx.strokeStyle = patternLineColor;
                ctx.lineWidth = patternLineWidth;
                for (let i = -height; i < width; i += patternSpacing) {
                    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + height, height); ctx.stroke();
                }
                for (let i = 0; i < width + height; i += patternSpacing) {
                    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - height, height); ctx.stroke();
                }
                ctx.strokeStyle = "#FFFFFF";
                ctx.lineWidth = 2;
                ctx.stroke();
                (ctx as any).imageSmoothingEnabled = true;
                texture.update(false);

                material.diffuseTexture = texture;
                material.useAlphaFromDiffuseTexture = true;
                material.transparencyMode = Material.MATERIAL_ALPHABLEND;

                console.log("[CardViz] Dynamic back texture created and assigned.");
                this.cardBackMaterial = material;
            }
            return material;
        } catch (error) {
            console.error(`[CardViz] CRITICAL error during material creation for ${cacheKey}:`, error);
            material?.dispose();
            const errorMatName = "errorMat_" + materialName;
            let errorMat = this.scene.getMaterialByName(errorMatName) as StandardMaterial;
            if (!errorMat) {
                errorMat = new StandardMaterial(errorMatName, this.scene);
                errorMat.diffuseColor = Color3.Magenta();
                errorMat.emissiveColor = Color3.Magenta();
                errorMat.backFaceCulling = false;
            }
             if (isFace) this.cardFaceMaterials.set(cacheKey, errorMat);
             else this.cardBackMaterial = errorMat;
            return errorMat;
        }
    }
    // --- End Material Creation ---
}
