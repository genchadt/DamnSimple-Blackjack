// src/scenes/components/cardvisualizer-ts (Fixed imageSmoothingEnabled type)
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
    private static readonly CARD_Y_POS = 0.05;
    private static readonly DECK_Y_POS = 0.01;

    private static readonly DEAL_DURATION_MS = 400;
    private static readonly REPOSITION_DURATION_MS = 300;
    private static readonly FLIP_DURATION_MS = 300;
    private static readonly FPS = 60;

    private static readonly TEXTURE_BASE_PATH = "assets/textures/playingcards/";

    private materialCache: Map<string, StandardMaterial> = new Map();
    private cardBackMaterial: StandardMaterial | null = null;

    constructor(scene: Scene, blackjackGame: BlackjackGame, deckPosition: Vector3) {
        this.scene = scene;
        this.blackjackGame = blackjackGame;
        this.deckPosition = deckPosition.clone();
        this.deckPosition.y = CardVisualizer.DECK_Y_POS;

        this.blackjackGame.addCardFlipCallback(
             "cardVisualizerFlipHandler",
             (card) => {
                console.log(`CardVisualizer received flip notification for ${card.toString()}`);
                this.updateCardVisual(card);
             }
        );
        this.getCardBackMaterial();
    }

    public setOnAnimationCompleteCallback(callback: () => void): void {
        this.onAnimationCompleteCallback = callback;
    }

    public getCardBackMaterial(): StandardMaterial | null {
        if (!this.cardBackMaterial) {
            this.cardBackMaterial = this.createCardMaterial(null);
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
        cardMesh.position = this.deckPosition.clone();
        cardMesh.rotation = new Vector3(Math.PI / 2, 0, Math.PI);
        cardMesh.material = this.getCardBackMaterial();
        this.cardMeshes.set(cardId, cardMesh);

        const finalPosition = this.calculateCardPosition(index, isPlayer, this.getHandSize(isPlayer));
        const finalRotationZ = faceUp ? 0 : Math.PI;
        this.animateCardDealing(cardMesh, finalPosition, finalRotationZ, faceUp, card);
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
        const rotationZ = card.isFaceUp() ? 0 : Math.PI;
        cardMesh.position = position;
        cardMesh.rotation = new Vector3(Math.PI / 2, 0, rotationZ);
        cardMesh.material = this.createCardMaterial(card.isFaceUp() ? card : null);
        this.cardMeshes.set(cardId, cardMesh);
    }

    private getHandSize(isPlayer: boolean): number { return isPlayer ? this.blackjackGame.getPlayerHand().length : this.blackjackGame.getDealerHand().length; }
    public renderCards(isRestoring: boolean = false): void { console.log(`Rendering cards... isRestoring: ${isRestoring}`); const playerHand = this.blackjackGame.getPlayerHand(); const dealerHand = this.blackjackGame.getDealerHand(); const allHands = [{ hand: playerHand, isPlayer: true }, { hand: dealerHand, isPlayer: false }]; allHands.forEach(({ hand, isPlayer }) => { if (!isRestoring) this.repositionCards(isPlayer, hand); hand.forEach((card, index) => { const cardId = card.getUniqueId(); if (!this.cardMeshes.has(cardId)) { if (isRestoring) this.createCardMeshInstant(card, index, isPlayer); else console.warn(`renderCards creating missing card: ${card.toString()}. Should be created on deal.`); } else if (isRestoring) { this.updateCardVisual(card, true); } }); }); const currentCardIds = new Set([...playerHand, ...dealerHand].map(c => c.getUniqueId())); this.cardMeshes.forEach((mesh, cardId) => { if (!currentCardIds.has(cardId)) { console.log(`Disposing stale card mesh: ${mesh.name}`); mesh.dispose(); this.cardMeshes.delete(cardId); } }); console.log(`Render complete. Total meshes: ${this.cardMeshes.size}`); }
    private repositionCards(isPlayer: boolean, hand: Card[]): void { const handSize = hand.length; hand.forEach((card, index) => { const cardId = card.getUniqueId(); const cardMesh = this.cardMeshes.get(cardId); if (cardMesh) { const newPosition = this.calculateCardPosition(index, isPlayer, handSize); if (!cardMesh.position.equalsWithEpsilon(newPosition, 0.01)) { this.animateVector3(cardMesh, "position", newPosition, CardVisualizer.REPOSITION_DURATION_MS, new QuadraticEase()); } } }); }
    private repositionCard(card: Card, index: number, isPlayer: boolean): void { const cardId = card.getUniqueId(); const cardMesh = this.cardMeshes.get(cardId); const handSize = this.getHandSize(isPlayer); if (cardMesh) { const newPosition = this.calculateCardPosition(index, isPlayer, handSize); if (!cardMesh.position.equalsWithEpsilon(newPosition, 0.01)) { this.animateVector3(cardMesh, "position", newPosition, CardVisualizer.REPOSITION_DURATION_MS, new QuadraticEase()); } } }
    private calculateCardPosition(index: number, isPlayer: boolean, handSize: number): Vector3 { const zPos = isPlayer ? 2.5 : -2.5; const yPos = CardVisualizer.CARD_Y_POS; const totalWidth = (handSize - 1) * CardVisualizer.CARD_SPACING; const startX = -(totalWidth / 2); const xPos = startX + (index * CardVisualizer.CARD_SPACING); return new Vector3(xPos, yPos, zPos); }

    public updateCardVisual(card: Card, forceImmediate: boolean = false): void {
        const cardId = card.getUniqueId();
        const cardMesh = this.cardMeshes.get(cardId);
        if (!cardMesh) { console.warn(`Cannot update visual for card ${card.toString()}, mesh not found.`); return; }
        console.log(`Updating visual for ${card.toString()} to faceUp=${card.isFaceUp()}, forceImmediate=${forceImmediate}`);

        const targetRotationZ = card.isFaceUp() ? 0 : Math.PI;
        const targetMaterial = this.createCardMaterial(card.isFaceUp() ? card : null);

        if (!targetMaterial) {
            console.error(`Could not get material for card ${card.toString()} (faceUp=${card.isFaceUp()})`);
            return;
        }

        if (forceImmediate || Math.abs(cardMesh.rotation.z - targetRotationZ) < 0.01) {
            cardMesh.material = targetMaterial;
            cardMesh.rotation.z = targetRotationZ;
        } else {
             this.animateFlip(cardMesh, targetRotationZ, targetMaterial);
        }
    }

    public clearTable(): void { console.log("Clearing table visuals..."); this.animationInProgress = false; this.cardMeshes.forEach(mesh => this.scene.stopAnimation(mesh)); this.cardMeshes.forEach(mesh => mesh.dispose()); this.cardMeshes.clear(); }
    public isAnimationInProgress(): boolean { return this.animationInProgress; }

    private animateCardDealing(mesh: Mesh, targetPos: Vector3, targetRotZ: number, faceUp: boolean, card: Card): void {
        this.animationInProgress = true;
        const durationFrames = CardVisualizer.DEAL_DURATION_MS / 1000 * CardVisualizer.FPS;
        const easing = new CubicEase(); easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

        const posAnim = new Animation("dealPosAnim", "position", CardVisualizer.FPS, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
        posAnim.setKeys([{ frame: 0, value: mesh.position.clone() }, { frame: durationFrames, value: targetPos }]);
        posAnim.setEasingFunction(easing);

        const rotAnim = new Animation("dealRotAnim", "rotation.z", CardVisualizer.FPS, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        rotAnim.setKeys([{ frame: 0, value: mesh.rotation.z }, { frame: durationFrames, value: targetRotZ }]);
        rotAnim.setEasingFunction(easing);

         if (faceUp && mesh.rotation.z !== targetRotZ) {
             const faceMaterial = this.createCardMaterial(card);
             if (faceMaterial) {
                 const materialUpdateEvent = new AnimationEvent(durationFrames / 2, () => {
                     console.log(`Updating material mid-deal for ${card.toString()}`);
                     mesh.material = faceMaterial;
                 }, true);
                 rotAnim.addEvent(materialUpdateEvent);
             } else {
                 console.error(`Could not get face material for ${card.toString()} during deal animation.`);
             }
         }

        this.scene.beginDirectAnimation(mesh, [posAnim, rotAnim], 0, durationFrames, false, 1,
            () => {
                this.animationInProgress = false;
                console.log(`Deal complete for ${card.toString()}`);
                mesh.material = this.createCardMaterial(faceUp ? card : null);
                mesh.rotation.z = targetRotZ;
                if (this.onAnimationCompleteCallback) {
                    this.onAnimationCompleteCallback();
                }
            }
        );
    }

     private animateFlip(mesh: Mesh, targetRotationZ: number, targetMaterial: StandardMaterial): void {
        this.animationInProgress = true;
        const durationFrames = CardVisualizer.FLIP_DURATION_MS / 1000 * CardVisualizer.FPS;
        const easing = new QuadraticEase(); easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

        const startRotationZ = mesh.rotation.z;
        console.log(`Starting flip animation for ${mesh.name} from rotZ ${startRotationZ} to ${targetRotationZ}`);

        const rotAnim = new Animation("flipRotAnim", "rotation.z", CardVisualizer.FPS, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        rotAnim.setKeys([{ frame: 0, value: startRotationZ }, { frame: durationFrames, value: targetRotationZ }]);
        rotAnim.setEasingFunction(easing);

        const materialUpdateEvent = new AnimationEvent(durationFrames / 2, () => {
            console.log(`Updating material mid-flip for ${mesh.name}`);
            mesh.material = targetMaterial;
        }, true);
        rotAnim.addEvent(materialUpdateEvent);

        this.scene.beginDirectAnimation(mesh, [rotAnim], 0, durationFrames, false, 1, () => {
            this.animationInProgress = false;
            mesh.rotation.z = targetRotationZ;
            console.log(`Flip animation complete for ${mesh.name}`);
            if (this.onAnimationCompleteCallback) this.onAnimationCompleteCallback();
        });
    }

    private animateVector3(mesh: Mesh, property: string, targetValue: Vector3, durationMs: number, easing?: EasingFunction): void { this.animationInProgress = true; const durationFrames = durationMs / 1000 * CardVisualizer.FPS; const effectiveEasing = easing ?? new CubicEase(); if (!easing) effectiveEasing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT); const anim = new Animation(`${property}Anim_${mesh.name}`, property, CardVisualizer.FPS, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT); let startValue: Vector3; if (property === 'position') { startValue = mesh.position.clone(); } else if (property === 'rotation') { startValue = mesh.rotation.clone(); } else { startValue = Vector3.Zero(); console.error(`animateVector3 called with unsupported property: ${property}`); this.animationInProgress = false; return; } anim.setKeys([{ frame: 0, value: startValue }, { frame: durationFrames, value: targetValue }]); anim.setEasingFunction(effectiveEasing); this.scene.beginDirectAnimation(mesh, [anim], 0, durationFrames, false, 1, () => { if (property === 'position') mesh.position = targetValue; else if (property === 'rotation') mesh.rotation = targetValue; this.animationInProgress = false; if (this.onAnimationCompleteCallback) this.onAnimationCompleteCallback(); }); }


    private getFaceTextureUrl(card: Card): string {
        const suitStr = card.getSuit().toUpperCase();
        const rankVal = card.getRankValueForTexture();
        return `${CardVisualizer.TEXTURE_BASE_PATH}${suitStr} ${rankVal}.png`;
    }

    private createCardMaterial(card: Card | null): StandardMaterial | null {
        let material: StandardMaterial | null = null;
        let cacheKey: string;
        let isFace: boolean = card !== null;

        if (isFace) {
            const textureUrl = this.getFaceTextureUrl(card!);
            cacheKey = textureUrl;

            if (this.materialCache.has(cacheKey)) {
                return this.materialCache.get(cacheKey)!;
            }

            console.log(`Creating face material for: ${cacheKey}`);
            material = new StandardMaterial(`material_${cacheKey.replace(/[^a-zA-Z0-9]/g, '_')}`, this.scene);

            try {
                const texture = new Texture(
                    textureUrl, this.scene, false, false, Texture.TRILINEAR_SAMPLINGMODE,
                    null,
                    (message, exception) => {
                        console.error(`Error loading texture ${textureUrl}: ${message}`, exception);
                    }
                );
                texture.hasAlpha = true;
                material.diffuseTexture = texture;
                material.useAlphaFromDiffuseTexture = true;

            } catch (error) {
                console.error(`Failed to create Texture object for ${textureUrl}:`, error);
                material.dispose();
                return null;
            }

        } else {
            cacheKey = "dynamicCardBack";

            if (this.materialCache.has(cacheKey)) {
                return this.materialCache.get(cacheKey)!;
            }
            if (this.cardBackMaterial) {
                 return this.cardBackMaterial;
            }

            console.log(`Creating dynamic back material: ${cacheKey}`);
            material = new StandardMaterial(`material_${cacheKey}`, this.scene);

            const textureSize = { width: 256, height: 358 };
            const texture = new DynamicTexture(`texture_${cacheKey}`, textureSize, this.scene, true);
            // *** FIX: Cast context here ***
            const ctx = texture.getContext() as CanvasRenderingContext2D;
            // *** FIX: Access property on cast context ***
            ctx.imageSmoothingEnabled = true;

            ctx.fillStyle = "#B22222";
            ctx.fillRect(0, 0, textureSize.width, textureSize.height);

            const borderWidth = 8;
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = borderWidth / 2;
            ctx.strokeRect(borderWidth / 2, borderWidth / 2, textureSize.width - borderWidth, textureSize.height - borderWidth);

            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
            ctx.lineWidth = 4;
            const spacing = 20;
            for (let i = -textureSize.height; i < textureSize.width; i += spacing) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i + textureSize.height, textureSize.height);
                ctx.stroke();
            }
            ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
            ctx.beginPath();
            ctx.arc(textureSize.width / 2, textureSize.height / 2, 50, 0, Math.PI * 2);
            ctx.fill();

            texture.update(false);
            material.diffuseTexture = texture;
            material.useAlphaFromDiffuseTexture = false;

            this.cardBackMaterial = material;
        }

        material.specularColor = new Color3(0.1, 0.1, 0.1);
        material.backFaceCulling = false;
        material.emissiveColor = new Color3(0.1, 0.1, 0.1);

        this.materialCache.set(cacheKey, material);

        return material;
    }
}
