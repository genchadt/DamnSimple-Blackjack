// src/scenes/components/cardvisualizer.ts
import { Scene, Vector3, MeshBuilder, StandardMaterial, Color3, Texture, DynamicTexture,
    Mesh, Animation, EasingFunction, CubicEase, QuadraticEase, SineEase, Material, BackEase, MultiMaterial, Vector4, SubMesh, Quaternion } from "@babylonjs/core";
import { Card } from "../../game/Card"; // Ensure Card is imported
import { BlackjackGame } from "../../game/BlackjackGame";
import { Constants } from "../../Constants";

export class CardVisualizer {
    private scene: Scene;
    private blackjackGame: BlackjackGame;
    private cardMeshes: Map<string, Mesh> = new Map();
    /** The X, Y, Z position where card deal animations originate. Y is calculated. */
    private animationOriginPosition: Vector3;
    private animationInProgress: boolean = false;
    private onAnimationCompleteCallback: (() => void) | null = null;

    // --- Constants Kept Local ---
    private static readonly SUBMESH_PLUS_Z = 0;
    private static readonly SUBMESH_MINUS_Z = 1;
    private static readonly SUBMESH_PLUS_X = 2;
    private static readonly SUBMESH_MINUS_X = 3;
    private static readonly SUBMESH_PLUS_Y = 4;
    private static readonly SUBMESH_MINUS_Y = 5;
    private static readonly MATIDX_FACE = 0;
    private static readonly MATIDX_BACK = 1;
    private static readonly MATIDX_SIDE = 2;

    // *** CORRECTED QUATERNION DEFINITIONS ***
    // Face Up: Rotate the box so its original -Z face (where face texture is applied) points towards world +Y
    private static readonly FACE_UP_FLAT_QUAT = Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2);
    // Face Down: Rotate the box so its original +Z face (where back texture is applied) points towards world +Y
    private static readonly FACE_DOWN_FLAT_QUAT = Quaternion.RotationAxis(Vector3.Right(), -Math.PI / 2);
    private static readonly QUATERNION_EPSILON = 0.001;

    // --- Material & Texture Cache / Singletons ---
    private cardBackMaterial: StandardMaterial | null = null;
    private cardSideMaterial: StandardMaterial | null = null;
    private cardFaceMaterials: Map<string, StandardMaterial> = new Map(); // Cache for materials using SVG textures
    private svgTextureCache: Map<string, Texture> = new Map(); // Cache for the loaded SVG textures
    private tempCardContainer: HTMLElement; // Current container for <playing-card> elements
    private internalTempCardContainer: HTMLElement; // Default hidden container

    constructor(scene: Scene, blackjackGame: BlackjackGame, deckPositionXZ: Vector3) {
        this.scene = scene;
        this.blackjackGame = blackjackGame;

        const animationOriginY = Constants.CARD_Y_POS + Constants.DECK_DISPENSER_Y_OFFSET;
        this.animationOriginPosition = new Vector3(deckPositionXZ.x, animationOriginY, deckPositionXZ.z);

        // Create and manage an internal hidden container for SVG generation
        this.internalTempCardContainer = this._createDefaultTempCardContainer();
        document.body.appendChild(this.internalTempCardContainer);
        this.tempCardContainer = this.internalTempCardContainer; // Use internal by default

        this.blackjackGame.addCardFlipCallback(
            "cardVisualizerFlipHandler",
            (card) => this.updateCardVisual(card, false)
        );
        this.getCardBackMaterial(); // Pre-cache back
        this.getCardSideMaterial(); // Pre-cache side
        console.log("[CardViz] Initialized (Using CardMeister SVGs).");
        console.log(`[CardViz] Animation Origin (animationOriginPosition): ${this.animationOriginPosition.toString()}`);
    }

    private _createDefaultTempCardContainer(): HTMLElement {
        const container = document.createElement("div");
        container.id = "cardmeister-internal-temp-container"; // Unique ID for internal
        Object.assign(container.style, {
            position: 'absolute',
            left: '-9999px', // Off-screen
            top: '-9999px',   // Off-screen
            width: '300px',   // Sufficient for rendering
            height: '400px',  // Sufficient for rendering
            overflow: 'hidden',
            pointerEvents: 'none', // Non-interactive
            // Opacity should not be 0 if it affects rendering, being off-screen is enough
        });
        return container;
    }

    /**
     * Allows an external (e.g., debug) container to be used for temporary card elements.
     * Caution: This can expose internal rendering details. Use for debugging only.
     */
    public setTempCardContainer(container: HTMLElement | null): void {
        if (container) {
            // If switching to a new container, move existing elements
            this.tempCardContainer.childNodes.forEach(node => {
                container.appendChild(node);
            });
        } else {
            // Revert to internal container
            this.tempCardContainer = this.internalTempCardContainer;
        }
    }

    public setOnAnimationCompleteCallback(callback: () => void): void {
        this.onAnimationCompleteCallback = callback;
    }

    // --- Material Getters ---
    public getCardBackMaterial(): StandardMaterial {
        if (!this.cardBackMaterial) {
            this.cardBackMaterial = this.createCardBackMaterialInternal(); // Use specific function
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

    /**
     * Gets or creates the StandardMaterial for a card's face using SVG texture.
     * Handles asynchronous texture loading.
     */
    public async getCardFaceMaterial(card: Card): Promise<StandardMaterial> {
        const cid = card.getCid(); // Use cid as the unique key
        const materialCacheKey = `svgMat_${cid}`;

        if (this.cardFaceMaterials.has(materialCacheKey)) {
            return this.cardFaceMaterials.get(materialCacheKey)!;
        }

        // Material doesn't exist, create it and load the texture
        const material = new StandardMaterial(materialCacheKey, this.scene);
        material.backFaceCulling = false;
        material.specularColor = new Color3(0.1, 0.1, 0.1);
        // Set a temporary color while loading
        material.diffuseColor = new Color3(0.9, 0.9, 0.9); // Light gray placeholder

        this.cardFaceMaterials.set(materialCacheKey, material); // Cache material immediately

        try {
            // Asynchronously get the SVG texture
            const svgTexture = await this.getOrCreateSVGTexture(card);
            // Once texture is loaded, apply it to the material
            material.diffuseTexture = svgTexture;

            // --- ENSURE ALPHA SETTINGS ARE CORRECT ---
            material.useAlphaFromDiffuseTexture = true; // Texture's alpha channel will be used
            material.transparencyMode = Material.MATERIAL_ALPHABLEND; // Enable alpha blending

            material.diffuseColor = Color3.White(); // Set diffuse to white to show texture colors accurately
            console.log(`%c[CardViz] SVG Texture applied to material ${materialCacheKey} for ${cid}. Using AlphaBlend.`, 'color: green');
        } catch (error) {
            console.error(`%c[CardViz] Failed to load SVG texture for ${cid} in getCardFaceMaterial:`, 'color: red', error);
            // material was already cached, modify its properties
            material.diffuseColor = new Color3(0, 1, 0); // Bright Green for distinction
            material.emissiveColor = new Color3(0, 0.5, 0); // Make it glow a bit green
            console.warn(`%c[CardViz]   -> Set material ${materialCacheKey} to GREEN error state for ${cid}`, 'color: green; font-weight: bold;');
        }

        return material;
    }

    /**
     * Gets a cached SVG texture or creates a new one by generating a <playing-card> element,
     * loading it into an HTMLImageElement, and then drawing it onto a DynamicTexture.
     * This method is more robust for handling SVG data URIs.
     */
    private getOrCreateSVGTexture(card: Card): Promise<Texture> {
        const cid = card.getCid();
        const textureCacheKey = `svgTex_dynamic_${cid}`; // Use a new cache key for the dynamic texture approach

        if (this.svgTextureCache.has(textureCacheKey)) {
            return Promise.resolve(this.svgTextureCache.get(textureCacheKey)!);
        }

        console.log(`%c[CardViz] Creating DYNAMIC SVG Texture for ${cid}...`, 'color: blue');

        return new Promise((resolve, reject) => {
            const cardElement = document.createElement('playing-card');
            cardElement.setAttribute('cid', cid);
            cardElement.id = `temp-card-${cid}-${Date.now()}`;
            cardElement.style.display = 'inline-block';
            cardElement.style.width = '70px';
            cardElement.style.height = '100px';
            cardElement.style.border = '1px solid green';
            cardElement.style.margin = '2px';

            let observer: MutationObserver | null = null;
            let timeoutId: number | null = null;

            const cleanup = () => {
                if (observer) {
                    observer.disconnect();
                    observer = null;
                }
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (cardElement.parentNode === this.tempCardContainer) {
                    this.tempCardContainer.removeChild(cardElement);
                }
            };

            const processImageSource = (imgSrc: string) => {
                console.log(`%c[CardViz]   -> Processing found image source for ${cid} with DynamicTexture`, 'color: orange');

                if (imgSrc.length < 500 && imgSrc.startsWith('data:image/svg+xml,')) {
                    console.warn(`%c[CardViz]   -> WARNING: Image source for ${cid} is very short. Actual length: ${imgSrc.length}. This is a likely cause of transparency. Source: ${imgSrc}`, 'color: red; font-weight: bold;');
                }

                const image = new Image();
                image.onload = () => {
                    console.log(`%c[CardViz]   -> HTMLImageElement loaded SVG for ${cid}. Dimensions: ${image.width}x${image.height}`, 'color: green');

                    const texWidth = image.width > 0 ? image.width : 256;
                    const texHeight = image.height > 0 ? image.height : 358;

                    const texture = new DynamicTexture(
                        `dynamic_svg_${cid}`,
                        { width: texWidth, height: texHeight },
                        this.scene,
                        true // generateMipMaps
                    );

                    texture.hasAlpha = true;

                    const ctx = texture.getContext();
                    // Draw the loaded image onto the dynamic texture's canvas
                    ctx.drawImage(image, 0, 0, texWidth, texHeight);

                    // Update the texture to apply the drawing
                    texture.update(true);

                    console.log(`%c[CardViz]   -> DynamicTexture created and updated for ${cid}`, 'color: green');
                    this.svgTextureCache.set(textureCacheKey, texture);
                    cleanup();
                    resolve(texture);
                };
                image.onerror = (err) => {
                    console.error(`%c[CardViz]   -> HTMLImageElement FAILED to load SVG for ${cid}`, 'color: red', err);
                    cleanup();
                    reject(new Error(`HTMLImageElement failed to load SVG data URI for ${cid}.`));
                };

                // Start loading the SVG data URI into the image element
                image.src = imgSrc;
            };

            observer = new MutationObserver((mutationsList) => {
                for (const mutation of mutationsList) {
                    let imgElement: HTMLImageElement | null = null;
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        imgElement = cardElement.querySelector('img');
                    } else if (mutation.type === 'attributes' && mutation.attributeName === 'src' && mutation.target instanceof HTMLImageElement) {
                        imgElement = mutation.target as HTMLImageElement;
                    }

                    if (imgElement && imgElement.src && imgElement.src.startsWith('data:image/svg+xml')) {
                        console.log(`%c[CardViz]   -> Found internal <img> src via ${mutation.type} for ${cid}`, 'color: blue');
                        if (observer) {
                            observer.disconnect();
                            observer = null;
                        }
                        processImageSource(imgElement.src);
                        return;
                    }
                }
            });

            observer.observe(cardElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
            this.tempCardContainer.appendChild(cardElement);
            console.log(`%c[CardViz]   -> Appended <playing-card cid=${cid}> to temp container. Waiting for internal <img> with data URI src...`, 'color: blue');

            timeoutId = window.setTimeout(() => {
                timeoutId = null;
                if (!this.svgTextureCache.has(textureCacheKey)) {
                    const imgElement = cardElement.querySelector('img');
                    if (imgElement && imgElement.src && imgElement.src.startsWith('data:image/svg+xml')) {
                        console.log(`%c[CardViz]   -> Found internal <img> src just before timeout expiry for ${cid}`, 'color: orange');
                        if (observer) { observer.disconnect(); observer = null; }
                        processImageSource(imgElement.src);
                    } else {
                        console.error(`%c[CardViz]   -> TIMEOUT waiting for internal <img> with data URI for ${cid}`, 'color: red; font-weight: bold;');
                        cleanup();
                        reject(new Error(`Timeout waiting for CardMeister element ${cid} to render SVG data URI.`));
                    }
                }
            }, 5000);
        });
    }
    // --- End Material Getters ---

    // --- Dimension Getters (remain the same) ---
    public getAnimationOriginY(): number { return this.animationOriginPosition.y; }
    public getCardWidth(): number { return Constants.CARD_WIDTH; }
    public getCardHeight(): number { return Constants.CARD_HEIGHT; }
    public getCardDepth(): number { return Constants.CARD_DEPTH; }
    public getCardCornerRadius(): number { return Constants.CARD_CORNER_RADIUS; }
    // --- End Dimension Getters ---


    /** Creates the card mesh and initiates material loading and animation. */
    public async createCardMesh(card: Card, index: number, isPlayer: boolean, faceUp: boolean): Promise<void> {
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
                width: Constants.CARD_WIDTH, height: Constants.CARD_HEIGHT, depth: Constants.CARD_DEPTH,
                faceUV: boxFaceUVs
            }, this.scene
        );

        cardMesh.position = this.animationOriginPosition.clone();
        cardMesh.rotationQuaternion = Quaternion.Identity();
        console.log(`%c[CardViz]   -> Mesh created at animation origin: ${cardMesh.position.toString()}. Initial rotationQuaternion: ${cardMesh.rotationQuaternion.toString()}`, 'color: #FF4500; font-weight: bold;');

        this.cardMeshes.set(cardId, cardMesh); // Store mesh immediately

        // --- Apply MultiMaterial Asynchronously ---
        const multiMat = new MultiMaterial(`multiMat_${cardId}`, this.scene);
        multiMat.subMaterials.push(null); // Placeholder for face [0]
        multiMat.subMaterials.push(this.getCardBackMaterial()); // Back [1]
        multiMat.subMaterials.push(this.getCardSideMaterial()); // Side [2]
        cardMesh.material = multiMat;

        console.log(`%c[CardViz]   -> Applying SubMesh assignments (Face[${CardVisualizer.MATIDX_FACE}] on -Z, Back[${CardVisualizer.MATIDX_BACK}] on +Z).`, 'color: green; font-weight: bold;');
        cardMesh.subMeshes = [];
        const verticesCount = cardMesh.getTotalVertices();
        new SubMesh(CardVisualizer.MATIDX_BACK, 0, verticesCount, 0, 6, cardMesh);  // Index 0 -> Material 1 (Back)
        new SubMesh(CardVisualizer.MATIDX_FACE, 0, verticesCount, 6, 6, cardMesh);  // Index 1 -> Material 0 (Face)
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 12, 6, cardMesh); // Index 2 -> Material 2 (Side)
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 18, 6, cardMesh); // Index 3 -> Material 2 (Side)
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 24, 6, cardMesh); // Index 4 -> Material 2 (Side)
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 30, 6, cardMesh); // Index 5 -> Material 2 (Side)


        // Asynchronously load and assign the face material
        this.getCardFaceMaterial(card).then(faceMaterial => {
            if (multiMat.subMaterials && multiMat.subMaterials.length > CardVisualizer.MATIDX_FACE) {
                multiMat.subMaterials[CardVisualizer.MATIDX_FACE] = faceMaterial;
                console.log(`%c[CardViz]   -> Assigned loaded face material for ${card.getCid()} to subMaterial index ${CardVisualizer.MATIDX_FACE}`, 'color: green');
            } else {
                console.warn(`[CardViz] MultiMaterial for ${card.getCid()} was disposed or invalid before face material loaded.`);
            }
        }).catch(err => {
            console.error(`[CardViz] Error setting face material for ${card.getCid()} in createCardMesh:`, err);
            if (multiMat.subMaterials && multiMat.subMaterials.length > CardVisualizer.MATIDX_FACE) {
                const errorMaterialCacheKey = `errorMat_face_${card.getCid()}`;
                let errorMaterial = this.scene.getMaterialByName(errorMaterialCacheKey) as StandardMaterial;
                if (!errorMaterial) {
                    errorMaterial = new StandardMaterial(errorMaterialCacheKey, this.scene);
                    errorMaterial.diffuseColor = new Color3(0, 0, 1);
                    errorMaterial.emissiveColor = new Color3(0, 0.5, 0);
                    errorMaterial.backFaceCulling = false;
                }
                multiMat.subMaterials[CardVisualizer.MATIDX_FACE] = errorMaterial;
                console.warn(`%c[CardViz]   -> Assigned BLUE error material for face of ${card.getCid()}`, 'color: blue; font-weight: bold;');
            }
        });

        console.log(`%c[CardViz]   -> Mesh added to cardMeshes map. Starting deal animation...`, 'color: #20B2AA');
        this.animateCardDealing(cardMesh, index, isPlayer, faceUp, card);
    }

    /** Creates a card mesh instantly at its final position/rotation. Used for restoring state. */
    private async createCardMeshInstant(card: Card, index: number, isPlayer: boolean): Promise<void> {
        const cardId = card.getUniqueId();
        console.log(`%c[CardViz] createCardMeshInstant for ${card.toString()}. IsPlayer: ${isPlayer}, Index: ${index}, FaceUp: ${card.isFaceUp()}`, 'color: #4682B4');

        const backUV = new Vector4(0, 0, 1, 1);
        const faceUV = new Vector4(0, 0, 1, 1);
        const sideUV = new Vector4(0, 0, 0.01, 0.01);
        const boxFaceUVs = [backUV, faceUV, sideUV, sideUV, sideUV, sideUV];

        const cardMesh = MeshBuilder.CreateBox(
            `card_${cardId}`, {
                width: Constants.CARD_WIDTH, height: Constants.CARD_HEIGHT, depth: Constants.CARD_DEPTH,
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

        this.cardMeshes.set(cardId, cardMesh);

        const multiMat = new MultiMaterial(`multiMat_${cardId}_instant`, this.scene);
        multiMat.subMaterials.push(null);
        multiMat.subMaterials.push(this.getCardBackMaterial());
        multiMat.subMaterials.push(this.getCardSideMaterial());
        cardMesh.material = multiMat;

        console.log(`%c[CardViz]   -> Applying SubMesh assignments (Instant).`, 'color: green; font-weight: bold;');
        cardMesh.subMeshes = [];
        const verticesCount = cardMesh.getTotalVertices();
        new SubMesh(CardVisualizer.MATIDX_BACK, 0, verticesCount, 0, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_FACE, 0, verticesCount, 6, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 12, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 18, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 24, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 30, 6, cardMesh);

        this.getCardFaceMaterial(card).then(faceMaterial => {
            if (multiMat.subMaterials && multiMat.subMaterials.length > CardVisualizer.MATIDX_FACE) {
                multiMat.subMaterials[CardVisualizer.MATIDX_FACE] = faceMaterial;
            }
        }).catch(err => {
            console.error(`[CardViz] Error setting face material for instant card ${card.getCid()}:`, err);
            if (multiMat.subMaterials && multiMat.subMaterials.length > CardVisualizer.MATIDX_FACE) {
                const errorMaterialCacheKey = `errorMat_face_instant_${card.getCid()}`;
                let errorMaterial = this.scene.getMaterialByName(errorMaterialCacheKey) as StandardMaterial;
                if (!errorMaterial) {
                    errorMaterial = new StandardMaterial(errorMaterialCacheKey, this.scene);
                    errorMaterial.diffuseColor = new Color3(0, 0.5, 1);
                    errorMaterial.emissiveColor = new Color3(0, 0.2, 0.5);
                    errorMaterial.backFaceCulling = false;
                }
                multiMat.subMaterials[CardVisualizer.MATIDX_FACE] = errorMaterial;
                console.warn(`%c[CardViz]   -> Assigned LIGHT BLUE error material for face of instant ${card.getCid()}`, 'color: blue; font-weight: bold;');
            }
        });
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

        const creationPromises: Promise<void>[] = [];

        allHands.forEach(({ hand, isPlayer }) => {
            const handSize = hand.length;
            hand.forEach((card, index) => {
                const cardId = card.getUniqueId();
                currentCardIds.add(cardId);
                let cardMesh = this.cardMeshes.get(cardId);

                if (!cardMesh) {
                    console.log(`%c[CardViz]   -> Mesh for ${card.toString()} not found. Creating instant mesh.`, 'color: #4682B4');
                    creationPromises.push(this.createCardMeshInstant(card, index, isPlayer));
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

        Promise.all(creationPromises).then(() => {
            this.cardMeshes.forEach((mesh, cardId) => {
                if (!currentCardIds.has(cardId)) {
                    console.log(`%c[CardViz]   -> Disposing mesh for removed card: ${cardId}`, 'color: #4682B4');
                    this.scene.stopAnimation(mesh);
                    mesh.material?.dispose();
                    mesh.dispose();
                    this.cardMeshes.delete(cardId);
                }
            });
            console.log(`%c[CardViz] renderCards finished processing.`, 'color: #4682B4');
        }).catch(error => {
            console.error("[CardViz] Error during async mesh creation in renderCards:", error);
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
                        Constants.REPOSITION_DURATION_MS,
                        ease,
                        false
                    );
                }
            } else if (!cardMesh && index < newHandSize - 1) {
                console.warn(`[CardViz] Cannot reposition existing card ${card.toString()}, mesh not found in map during repositioning.`);
            }
        });
    }


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
        this.cardMeshes.forEach(mesh => {
            this.scene.stopAnimation(mesh);
            mesh.material?.dispose();
            mesh.dispose();
        });
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
            () => {
                console.log(`%c[CardViz] <<< Deal Animation CALLBACK START for ${card.toString()} (Mesh: ${mesh.name})`, 'color: #1E90FF; font-weight: bold;');

                mesh.position = targetPos;
                mesh.rotationQuaternion = targetQuat.clone();

                const logicalCard = this.blackjackGame.getPlayerHand().find(c => c.getUniqueId() === cardId) || this.blackjackGame.getDealerHand().find(c => c.getUniqueId() === cardId);
                if (logicalCard && mesh.rotationQuaternion) {
                    const expectedQuat = logicalCard.isFaceUp() ? CardVisualizer.FACE_UP_FLAT_QUAT : CardVisualizer.FACE_DOWN_FLAT_QUAT;
                    if (!mesh.rotationQuaternion.equalsWithEpsilon(expectedQuat, CardVisualizer.QUATERNION_EPSILON)) {
                        console.warn(`%c[CardViz]       POST-ANIMATION MISMATCH! Mesh Quat ${mesh.rotationQuaternion.toString()} does not match expected ${expectedQuat.toString()} for logical state FaceUp=${logicalCard.isFaceUp()}. Forcing correction.`, 'color: red; font-weight: bold;');
                        mesh.rotationQuaternion = expectedQuat.clone();
                    }
                } else {
                    console.warn(`[CardViz] Could not find logical card ${cardId} or mesh quaternion after deal animation to verify final rotation.`);
                }

                this.animationInProgress = false;

                if (this.onAnimationCompleteCallback) {
                    setTimeout(() => {
                        if (!this.isAnimationInProgress() && this.onAnimationCompleteCallback) {
                            this.onAnimationCompleteCallback();
                        } else {
                            console.warn(`[CardViz] Deal Callback skipped: Another animation started or callback became null.`);
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
        const durationFrames = Constants.FLIP_DURATION_MS / 1000 * Constants.FPS;
        const easing = new QuadraticEase(); easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

        const startQuat = mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : CardVisualizer.FACE_UP_FLAT_QUAT;
        if (!mesh.rotationQuaternion) mesh.rotationQuaternion = startQuat.clone();

        const rotQuatAnim = new Animation("flipRotQuatAnim", "rotationQuaternion", Constants.FPS, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CONSTANT);
        rotQuatAnim.setKeys([{ frame: 0, value: startQuat }, { frame: durationFrames, value: targetQuat }]);
        rotQuatAnim.setEasingFunction(easing);

        this.scene.beginDirectAnimation(mesh, [rotQuatAnim], 0, durationFrames, false, 1, () => {
            console.log(`%c[CardViz] <<< Flip Animation CALLBACK START for mesh ${mesh.name}`, 'color: orange; font-weight: bold;');

            mesh.rotationQuaternion = targetQuat.clone();

            this.animationInProgress = false;

            if (this.onAnimationCompleteCallback) {
                setTimeout(() => {
                    if (!this.isAnimationInProgress() && this.onAnimationCompleteCallback) {
                        this.onAnimationCompleteCallback();
                    } else {
                        console.warn(`[CardViz] Flip Callback skipped: Another animation started or callback became null.`);
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

        if (triggerCompletionCallback) {
            this.animationInProgress = true;
        }

        const durationFrames = durationMs / 1000 * Constants.FPS;
        const effectiveEasing = easing ?? new CubicEase();
        if (!easing) effectiveEasing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

        const anim = new Animation(
            `${property}Anim_${mesh.name}_${Date.now()}`,
            property,
            Constants.FPS,
            Animation.ANIMATIONTYPE_VECTOR3,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        let startValue = mesh.position.clone();

        if (startValue.equalsWithEpsilon(targetValue, 0.001)) {
            if (triggerCompletionCallback) this.animationInProgress = false;
            return;
        }

        anim.setKeys([{ frame: 0, value: startValue }, { frame: durationFrames, value: targetValue }]);
        anim.setEasingFunction(effectiveEasing);

        this.scene.beginDirectAnimation(mesh, [anim], 0, durationFrames, false, 1.0, () => {
            mesh.position = targetValue;
            if (triggerCompletionCallback) {
                console.log(`%c[CardViz] animateVector3 completed for ${mesh.name} (triggering callback).`, 'color: gray');
                this.animationInProgress = false;
                if(this.onAnimationCompleteCallback) {
                    setTimeout(() => {
                        if (!this.isAnimationInProgress() && this.onAnimationCompleteCallback) {
                            this.onAnimationCompleteCallback();
                        } else {
                            console.warn(`[CardViz] animateVector3 Callback skipped: Another animation started or callback became null.`);
                        }
                    }, 0);
                }
            }
        });
    }


    private createCardBackMaterialInternal(): StandardMaterial {
        const materialName = "cardBackMatDynamic";
        let material = this.scene.getMaterialByName(materialName) as StandardMaterial;
        if (material) return material;

        material = new StandardMaterial(materialName, this.scene);
        material.backFaceCulling = false;
        material.specularColor = new Color3(0.1, 0.1, 0.1);
        material.diffuseColor = Color3.White();

        try {
            console.log("[CardViz] Creating DYNAMIC card back material...");
            const textureSize = { width: 256, height: 358 };
            const cornerRadius = 20;

            const texture = new DynamicTexture("dynamicCardBackTexture", textureSize, this.scene, true);
            texture.hasAlpha = true;

            const ctx = texture.getContext();
            const width = textureSize.width;
            const height = textureSize.height;

            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = "#B22222";
            ctx.beginPath();
            ctx.moveTo(cornerRadius, 0);
            ctx.lineTo(width - cornerRadius, 0);
            (ctx as any).arcTo(width, 0, width, cornerRadius, cornerRadius);
            ctx.lineTo(width, height - cornerRadius);
            (ctx as any).arcTo(width, height, width - cornerRadius, height, cornerRadius);
            ctx.lineTo(cornerRadius, height);
            (ctx as any).arcTo(0, height, 0, height - cornerRadius, cornerRadius);
            ctx.lineTo(0, cornerRadius);
            (ctx as any).arcTo(0, 0, cornerRadius, 0, cornerRadius);
            ctx.closePath();
            ctx.fill();

            const patternLineColor = "rgba(0, 0, 0, 0.15)";
            const patternLineWidth = 1;
            const patternSpacing = 8;
            ctx.strokeStyle = patternLineColor;
            ctx.lineWidth = patternLineWidth;
            ctx.clip();
            for (let i = -height; i < width; i += patternSpacing) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + height, height); ctx.stroke();
            }
            for (let i = 0; i < width + height; i += patternSpacing) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - height, height); ctx.stroke();
            }

            (ctx as any).imageSmoothingEnabled = true;
            texture.update(false);

            material.diffuseTexture = texture;
            material.useAlphaFromDiffuseTexture = true;
            material.transparencyMode = Material.MATERIAL_ALPHABLEND;

            console.log("[CardViz] Dynamic back texture created and assigned.");
            this.cardBackMaterial = material;

        } catch (error) {
            console.error("[CardViz] CRITICAL error during dynamic back material creation:", error);
            material.diffuseColor = new Color3(1.0, 0.6, 0.6);
        }
        return material;
    }
}
