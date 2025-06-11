// src/scenes/components/CardVisualizer.ts
import { Scene, Vector3, MeshBuilder, StandardMaterial, Color3, Texture, DynamicTexture,
    Mesh, Animation, EasingFunction, CubicEase, QuadraticEase, SineEase, Material, BackEase, MultiMaterial, Vector4, SubMesh, Quaternion, AbstractMesh } from "@babylonjs/core";
import { Card } from "../../game/Card"; // Ensure Card is imported
import { BlackjackGame, PlayerHandInfo } from "../../game/BlackjackGame"; // Import PlayerHandInfo
import { GameState, GameResult } from "../../game/GameState"; // Import GameResult
import { Constants, QualityLevel, QualitySettings, DEFAULT_QUALITY_LEVEL } from "../../Constants";
import { ScoreCalculator } from "../../game/ScoreCalculator"; // Import ScoreCalculator

export class CardVisualizer {
    private scene: Scene;
    private blackjackGame: BlackjackGame;
    private cardMeshes: Map<string, Mesh> = new Map(); // Card UniqueID -> Mesh
    /** The X, Y, Z position where card deal animations originate. Y is calculated. */
    private animationOriginPosition: Vector3;
    private animationInProgress: boolean = false;
    private onAnimationCompleteCallback: (() => void) | null = null;
    private currentTextureSize: number;

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

    // Face Up: Rotate the box so its original -Z face (where face texture is applied) points towards world +Y
    private static readonly FACE_UP_FLAT_QUAT = Quaternion.RotationAxis(Vector3.RightReadOnly, Math.PI / 2);
    // Face Down: Rotate the box so its original +Z face (where back texture is applied) points towards world +Y
    private static readonly FACE_DOWN_FLAT_QUAT = Quaternion.RotationAxis(Vector3.RightReadOnly, -Math.PI / 2);
    private static readonly QUATERNION_EPSILON = 0.001;

    // --- Material & Texture Cache / Singletons ---
    private cardBackMaterial: StandardMaterial | null = null;
    private cardSideMaterial: StandardMaterial | null = null;
    private cardFaceMaterials: Map<string, StandardMaterial> = new Map(); // Cache for materials using SVG textures
    private svgTextureCache: Map<string, Texture> = new Map(); // Cache for the loaded SVG textures
    private internalTempCardContainer: HTMLElement; // Default hidden container for <playing-card> elements

    // For split hand visuals
    private dimmedMaterial: StandardMaterial | null = null;
    private bustedMaterial: StandardMaterial | null = null;


    constructor(scene: Scene, blackjackGame: BlackjackGame, deckPositionXZ: Vector3) {
        this.scene = scene;
        this.blackjackGame = blackjackGame;
        this.currentTextureSize = QualitySettings[DEFAULT_QUALITY_LEVEL].textureSize;

        const animationOriginY = Constants.CARD_Y_POS + Constants.DECK_DISPENSER_Y_OFFSET;
        this.animationOriginPosition = new Vector3(deckPositionXZ.x, animationOriginY, deckPositionXZ.z);

        // Create and manage an internal hidden container for SVG generation
        this.internalTempCardContainer = this._createDefaultTempCardContainer();
        document.body.appendChild(this.internalTempCardContainer);

        this.blackjackGame.addCardFlipCallback(
            "cardVisualizerFlipHandler",
            (card) => this.updateCardVisual(card, false) // This will find the card in its hand
        );
        this.getCardBackMaterial(); // Pre-cache back
        this.getCardSideMaterial(); // Pre-cache side
        this.getDimmedMaterial(); // Pre-cache dimmed material
        this.getBustedMaterial(); // Pre-cache busted material

        console.log("[CardViz] Initialized (Using CardMeister SVGs).");
        console.log(`[CardViz] Animation Origin (animationOriginPosition): ${this.animationOriginPosition.toString()}`);
    }

    /**
     * Sets the quality level, updating texture size and clearing caches.
     * @param level The new quality level.
     */
    public setQualityLevel(level: QualityLevel): void {
        const newTextureSize = QualitySettings[level].textureSize;
        if (this.currentTextureSize !== newTextureSize) {
            console.log(`%c[CardViz] Quality Change: Updating texture size from ${this.currentTextureSize} to ${newTextureSize}.`, 'color: fuchsia');
            this.currentTextureSize = newTextureSize;
            // Clear caches to force regeneration of textures and materials at the new resolution
            this.svgTextureCache.clear();
            this.cardFaceMaterials.clear();
            // Materials for dimmed/busted are simple colors, no need to clear unless they depend on texture size.
            console.log(`%c[CardViz]   -> Cleared SVG texture and material caches.`, 'color: fuchsia');
        }
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

    private getDimmedMaterial(): StandardMaterial {
        if (!this.dimmedMaterial) {
            this.dimmedMaterial = new StandardMaterial("dimmedOverlayMat", this.scene);
            this.dimmedMaterial.diffuseColor = new Color3(0.2, 0.2, 0.2); // Dark gray
            this.dimmedMaterial.alpha = 0.6; // Semi-transparent
        }
        return this.dimmedMaterial;
    }

    private getBustedMaterial(): StandardMaterial {
        if (!this.bustedMaterial) {
            this.bustedMaterial = new StandardMaterial("bustedOverlayMat", this.scene);
            this.bustedMaterial.diffuseColor = new Color3(0.6, 0.1, 0.1); // Dark red
            this.bustedMaterial.alpha = 0.5; // Semi-transparent
        }
        return this.bustedMaterial;
    }


    /**
     * Gets or creates the StandardMaterial for a card's face using SVG texture.
     * Handles asynchronous texture loading.
     */
    public async getCardFaceMaterial(card: Card): Promise<StandardMaterial> {
        const cid = card.getCid(); // Use cid as the unique key
        const materialCacheKey = `svgMat_${cid}_${this.currentTextureSize}`; // Include size in key

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
            // console.log(`%c[CardViz] SVG Texture applied to material ${materialCacheKey} for ${cid}. Using AlphaBlend.`, 'color: green');
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
        const textureCacheKey = `svgTex_dynamic_${cid}_${this.currentTextureSize}`;

        if (this.svgTextureCache.has(textureCacheKey)) {
            return Promise.resolve(this.svgTextureCache.get(textureCacheKey)!);
        }

        // console.log(`%c[CardViz] Creating DYNAMIC SVG Texture for ${cid} at size ${this.currentTextureSize}...`, 'color: blue');

        return new Promise((resolve, reject) => {
            const cardElement = document.createElement('playing-card');
            cardElement.setAttribute('cid', cid);
            cardElement.id = `temp-card-${cid}-${Date.now()}`;
            cardElement.style.display = 'inline-block'; // Important for rendering
            // These dimensions are for the temporary HTML element, not the final texture
            cardElement.style.width = `${this.currentTextureSize}px`;
            cardElement.style.height = `${this.currentTextureSize * Constants.CARD_ASPECT_RATIO}px`;


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
                // Use internalTempCardContainer for cleanup
                if (cardElement.parentNode === this.internalTempCardContainer) {
                    this.internalTempCardContainer.removeChild(cardElement);
                }
            };

            const processImageSource = (imgSrc: string) => {
                // console.log(`%c[CardViz]   -> Processing found image source for ${cid} with DynamicTexture`, 'color: orange');

                if (imgSrc.length < 500 && imgSrc.startsWith('data:image/svg+xml,')) {
                    // console.warn(`%c[CardViz]   -> WARNING: Image source for ${cid} is very short. Actual length: ${imgSrc.length}. This is a likely cause of transparency. Source: ${imgSrc}`, 'color: red; font-weight: bold;');
                }

                const image = new Image();
                image.onload = () => {
                    // console.log(`%c[CardViz]   -> HTMLImageElement loaded SVG for ${cid}. Dimensions: ${image.width}x${image.height}`, 'color: green');

                    const texWidth = this.currentTextureSize;
                    const texHeight = this.currentTextureSize * Constants.CARD_ASPECT_RATIO;

                    const texture = new DynamicTexture(
                        `dynamic_svg_${cid}_${this.currentTextureSize}`,
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

                    // console.log(`%c[CardViz]   -> DynamicTexture created and updated for ${cid} at ${texWidth}x${texHeight}`, 'color: green');
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
                        // console.log(`%c[CardViz]   -> Found internal <img> src via ${mutation.type} for ${cid}`, 'color: blue');
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
            // Use internalTempCardContainer for appending
            this.internalTempCardContainer.appendChild(cardElement);
            // console.log(`%c[CardViz]   -> Appended <playing-card cid=${cid}> to internal temp container. Waiting for internal <img> with data URI src...`, 'color: blue');

            timeoutId = window.setTimeout(() => {
                timeoutId = null;
                if (!this.svgTextureCache.has(textureCacheKey)) {
                    const imgElement = cardElement.querySelector('img');
                    if (imgElement && imgElement.src && imgElement.src.startsWith('data:image/svg+xml')) {
                        // console.log(`%c[CardViz]   -> Found internal <img> src just before timeout expiry for ${cid}`, 'color: orange');
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


    /** Creates the card mesh and initiates material loading and animation.
     * @param handDisplayIndex For player, this is the index in playerHands array. For dealer, it's typically 0.
     */
    public async createCardMesh(card: Card, indexInHand: number, isPlayer: boolean, handDisplayIndex: number, faceUp: boolean): Promise<void> {
        const targetDesc = isPlayer ? `Player Hand ${handDisplayIndex}` : 'Dealer';
        // console.log(`%c[CardViz] createCardMesh called for ${card.toString()} to ${targetDesc}. IndexInHand: ${indexInHand}, FaceUp (target): ${faceUp}`, 'color: #20B2AA');

        const cardId = card.getUniqueId();
        let cardMesh = this.cardMeshes.get(cardId);

        const isHoleCardCandidateOnCreate = !isPlayer && indexInHand === 0;
        if (isHoleCardCandidateOnCreate) {
            console.log(`%c[CardViz HOLE_DEBUG] createCardMesh for HOLE CARD ${card.toString()} (ID: ${cardId}). Mesh exists: ${!!cardMesh}. Target FaceUp: ${faceUp}`, 'color: red;');
        }


        if (cardMesh) { // Mesh already exists
            // console.log(`%c[CardViz] createCardMesh: Reusing existing mesh for ${card.toString()}`, 'color: #20B2AA');
            // If reusing for a new deal animation, ensure it starts from the deck.
            cardMesh.position = this.animationOriginPosition.clone();
            cardMesh.rotationQuaternion = Quaternion.Identity(); // Default orientation for new animation from deck
        } else { // Mesh does not exist, create it
            // console.log(`%c[CardViz]   -> Creating NEW BOX mesh for ${card.toString()}.`, 'color: green;');
            const backUV = new Vector4(0, 0, 1, 1);
            const faceUV = new Vector4(0, 0, 1, 1);
            const sideUV = new Vector4(0, 0, 0.01, 0.01); // Small UV area for solid color
            const boxFaceUVs: Vector4[] = [];
            boxFaceUVs[CardVisualizer.SUBMESH_MINUS_Z] = faceUV; // Face texture on -Z
            boxFaceUVs[CardVisualizer.SUBMESH_PLUS_Z] = backUV;  // Back texture on +Z
            for (let i = 2; i < 6; i++) boxFaceUVs[i] = sideUV; // Sides

            cardMesh = MeshBuilder.CreateBox(
                `card_${cardId}`, {
                    width: Constants.CARD_WIDTH, height: Constants.CARD_HEIGHT, depth: Constants.CARD_DEPTH,
                    faceUV: boxFaceUVs,
                    wrap: false // Important for correct UV mapping on box faces if faceUV is used this way
                }, this.scene
            );
            cardMesh.position = this.animationOriginPosition.clone(); // New cards start at deck
            cardMesh.rotationQuaternion = Quaternion.Identity(); // Default orientation for new cards from deck
            this.cardMeshes.set(cardId, cardMesh);

            const multiMat = new MultiMaterial(`multiMat_${cardId}`, this.scene);
            multiMat.subMaterials[CardVisualizer.MATIDX_BACK] = this.getCardBackMaterial();
            multiMat.subMaterials[CardVisualizer.MATIDX_SIDE] = this.getCardSideMaterial();

            try {
                multiMat.subMaterials[CardVisualizer.MATIDX_FACE] = await this.getCardFaceMaterial(card);
            } catch (err) {
                console.error(`[CardViz] Error getting face material for ${card.getCid()} in createCardMesh:`, err);
                // Fallback to an error material if needed, but ensure it's not null
                const errorMaterialCacheKey = `errorMat_face_runtime_${card.getCid()}`;
                let errorMaterial = this.scene.getMaterialByName(errorMaterialCacheKey) as StandardMaterial;
                if (!errorMaterial) {
                    errorMaterial = new StandardMaterial(errorMaterialCacheKey, this.scene);
                    errorMaterial.diffuseColor = new Color3(1, 0, 1); // Magenta for runtime error
                    errorMaterial.emissiveColor = new Color3(0.5, 0, 0.5);
                    errorMaterial.backFaceCulling = false;
                }
                multiMat.subMaterials[CardVisualizer.MATIDX_FACE] = errorMaterial;
            }

            cardMesh.material = multiMat;

            cardMesh.subMeshes = [];
            const verticesCount = cardMesh.getTotalVertices();
            new SubMesh(CardVisualizer.MATIDX_BACK, 0, verticesCount, 0, 6, cardMesh);  // +Z face of box -> Back Material
            new SubMesh(CardVisualizer.MATIDX_FACE, 0, verticesCount, 6, 6, cardMesh);  // -Z face of box -> Face Material
            new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 12, 6, cardMesh); // +X face
            new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 18, 6, cardMesh); // -X face
            new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 24, 6, cardMesh); // +Y face
            new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 30, 6, cardMesh); // -Y face
        }


        // console.log(`%c[CardViz]   -> Mesh added to cardMeshes map. Starting deal animation...`, 'color: #20B2AA');
        this.animateCardDealing(cardMesh!, indexInHand, isPlayer, handDisplayIndex, faceUp, card);
    }

    /** Creates a card mesh instantly at its final position/rotation. Used for restoring state. */
    private async createCardMeshInstant(card: Card, indexInHand: number, isPlayer: boolean, handInfo: PlayerHandInfo, handDisplayIndex: number): Promise<void> {
        const cardId = card.getUniqueId();
        const targetDesc = isPlayer ? `Player Hand ${handDisplayIndex}` : 'Dealer';
        // console.log(`%c[CardViz] createCardMeshInstant for ${card.toString()} to ${targetDesc}. IndexInHand: ${indexInHand}, FaceUp: ${card.isFaceUp()}`, 'color: #4682B4');

        const backUV = new Vector4(0, 0, 1, 1);
        const faceUV = new Vector4(0, 0, 1, 1);
        const sideUV = new Vector4(0, 0, 0.01, 0.01);
        const boxFaceUVs: Vector4[] = [];
        boxFaceUVs[CardVisualizer.SUBMESH_MINUS_Z] = faceUV; // Face texture on -Z
        boxFaceUVs[CardVisualizer.SUBMESH_PLUS_Z] = backUV;  // Back texture on +Z
        for (let i = 2; i < 6; i++) boxFaceUVs[i] = sideUV; // Sides


        const cardMesh = MeshBuilder.CreateBox(
            `card_${cardId}`, {
                width: Constants.CARD_WIDTH, height: Constants.CARD_HEIGHT, depth: Constants.CARD_DEPTH,
                faceUV: boxFaceUVs,
                wrap: false
            }, this.scene
        );

        const { position, rotationQuaternion, scaling } = this.calculateCardTransform(
            card, indexInHand, isPlayer, handInfo, handDisplayIndex, handInfo.cards.length
        );
        cardMesh.position = position;
        cardMesh.rotationQuaternion = rotationQuaternion.clone();
        cardMesh.scaling = scaling;

        // console.log(`%c[CardViz]   -> Instant Position: ${position.toString()}`, 'color: #4682B4');
        // console.log(`%c[CardViz]   -> Instant rotationQuaternion: ${cardMesh.rotationQuaternion.toString()}`, 'color: #4682B4');
        // console.log(`%c[CardViz]   -> Instant scaling: ${cardMesh.scaling.toString()}`, 'color: #4682B4');

        this.cardMeshes.set(cardId, cardMesh);
        if (isPlayer) this.applyVisualTreatment(cardMesh, handInfo, handDisplayIndex);


        const multiMat = new MultiMaterial(`multiMat_${cardId}_instant`, this.scene);
        multiMat.subMaterials[CardVisualizer.MATIDX_FACE] = null;
        multiMat.subMaterials[CardVisualizer.MATIDX_BACK] = this.getCardBackMaterial();
        multiMat.subMaterials[CardVisualizer.MATIDX_SIDE] = this.getCardSideMaterial();
        cardMesh.material = multiMat;

        // console.log(`%c[CardViz]   -> Applying SubMesh assignments (Instant).`, 'color: green; font-weight: bold;');
        cardMesh.subMeshes = [];
        const verticesCount = cardMesh.getTotalVertices();
        new SubMesh(CardVisualizer.MATIDX_BACK, 0, verticesCount, 0, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_FACE, 0, verticesCount, 6, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 12, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 18, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 24, 6, cardMesh);
        new SubMesh(CardVisualizer.MATIDX_SIDE, 0, verticesCount, 30, 6, cardMesh);

        try {
            const faceMaterial = await this.getCardFaceMaterial(card); // Await the material loading
            if (multiMat.subMaterials && multiMat.subMaterials.length > CardVisualizer.MATIDX_FACE) {
                multiMat.subMaterials[CardVisualizer.MATIDX_FACE] = faceMaterial;
            }
        } catch (err) {
            console.error(`[CardViz] Error setting face material for instant card ${card.getCid()}:`, err);
            if (multiMat.subMaterials && multiMat.subMaterials.length > CardVisualizer.MATIDX_FACE) {
                const errorMaterialCacheKey = `errorMat_face_instant_${card.getCid()}`;
                let errorMaterial = this.scene.getMaterialByName(errorMaterialCacheKey) as StandardMaterial;
                if (!errorMaterial) {
                    errorMaterial = new StandardMaterial(errorMaterialCacheKey, this.scene);
                    errorMaterial.diffuseColor = new Color3(0, 0.5, 1); // Light blue for error
                    errorMaterial.emissiveColor = new Color3(0, 0.2, 0.5);
                    errorMaterial.backFaceCulling = false;
                }
                multiMat.subMaterials[CardVisualizer.MATIDX_FACE] = errorMaterial;
            }
        }
    }

    public renderCards(isRestoring: boolean = false): void {
        // console.log(`%c[CardViz] renderCards called. IsRestoring: ${isRestoring}`, 'color: #4682B4');
        const playerHands = this.blackjackGame.getPlayerHands();
        const dealerHandFromGame = this.blackjackGame.getDealerHand(); // Get a stable reference
        const allVisibleCardIds = new Set<string>();
        const creationPromises: Promise<void>[] = [];
        const animationPromises: Promise<void>[] = []; // For animations triggered by renderCards
        const currentGameState = this.blackjackGame.getGameState(); // Get state once

        // Render Player Hands
        playerHands.forEach((handInfo, handDisplayIndex) => {
            handInfo.cards.forEach((card, indexInHand) => {
                const cardId = card.getUniqueId();
                allVisibleCardIds.add(cardId);
                let cardMesh = this.cardMeshes.get(cardId);

                if (!cardMesh) {
                    if (isRestoring) {
                        creationPromises.push(this.createCardMeshInstant(card, indexInHand, true, handInfo, handDisplayIndex));
                    } else if (currentGameState !== GameState.Dealing) {
                        // Only create instantly if NOT in Dealing state and not restoring.
                        // During Dealing, createCardMesh (via notifyCardDealt) is responsible.
                        const targetDesc = `Player Hand ${handDisplayIndex}`;
                        console.warn(`[CardViz] renderCards: Mesh for player card ${card.toString()} (Hand ${handDisplayIndex}) not found. State: ${GameState[currentGameState]}. Creating instant as fallback.`);
                        creationPromises.push(this.createCardMeshInstant(card, indexInHand, true, handInfo, handDisplayIndex));
                    } else {
                        // In Dealing state and mesh not found: do nothing here.
                        // The animated createCardMesh path is expected to handle it.
                        // console.log(`[CardViz] renderCards: Mesh for player card ${card.toString()} (Hand ${handDisplayIndex}) not found. State is Dealing. Expecting animated path.`);
                    }
                } else {
                    const { position, rotationQuaternion, scaling } = this.calculateCardTransform(
                        card, indexInHand, true, handInfo, handDisplayIndex, handInfo.cards.length
                    );

                    let needsChange = !cardMesh.position.equalsWithEpsilon(position, 0.01) ||
                        !(cardMesh.rotationQuaternion && cardMesh.rotationQuaternion.equalsWithEpsilon(rotationQuaternion, CardVisualizer.QUATERNION_EPSILON)) ||
                        !cardMesh.scaling.equalsWithEpsilon(scaling, 0.01);
                    if (!cardMesh.rotationQuaternion && rotationQuaternion) needsChange = true;


                    if (!isRestoring && needsChange) {
                        animationPromises.push(this.animateMeshToTransform(cardMesh, position, rotationQuaternion, scaling, Constants.SPLIT_CARD_ANIM_DURATION_MS, false)); // isPrimaryAnimation = false
                    } else if (needsChange) { // Instant update if restoring or no animation needed
                        cardMesh.position = position;
                        if (!cardMesh.rotationQuaternion) cardMesh.rotationQuaternion = Quaternion.Identity();
                        cardMesh.rotationQuaternion.copyFrom(rotationQuaternion);
                        cardMesh.scaling = scaling;
                    }
                    this.applyVisualTreatment(cardMesh, handInfo, handDisplayIndex);
                }
            });
        });

        // Render Dealer Hand
        dealerHandFromGame.forEach((card, indexInHand) => {
            const cardId = card.getUniqueId();
            allVisibleCardIds.add(cardId);
            let cardMesh = this.cardMeshes.get(cardId);
            const dummyDealerHandInfo: PlayerHandInfo = { id: "dealer", cards: dealerHandFromGame, bet: 0, result: GameResult.InProgress, isResolved: false, canHit: true, isBlackjack: false, isSplitAces: false };

            if (indexInHand === 0) { // This is the hole card candidate
                console.log(`%c[CardViz HOLE_DEBUG] renderCards: Processing dealer card 0 (HOLE): ${card.toString()} (ID: ${cardId}). Mesh found: ${!!cardMesh}. FaceUp: ${card.isFaceUp()}`, 'color: red;');
            }

            if (!cardMesh) {
                if (isRestoring) {
                    creationPromises.push(this.createCardMeshInstant(card, indexInHand, false, dummyDealerHandInfo, 0));
                } else if (currentGameState !== GameState.Dealing) {
                    // Only create instantly if NOT in Dealing state and not restoring.
                    // During Dealing, createCardMesh (via notifyCardDealt) is responsible.
                    console.warn(`[CardViz] renderCards: Mesh for dealer card ${card.toString()} not found. State: ${GameState[currentGameState]}. Creating instant as fallback.`);
                    creationPromises.push(this.createCardMeshInstant(card, indexInHand, false, dummyDealerHandInfo, 0));
                } else {
                    // In Dealing state and mesh not found: do nothing here.
                    // The animated createCardMesh path is expected to handle it for the hole card or any other dealer card during initial deal.
                    if (indexInHand === 0 && !card.isFaceUp()) { // Specifically for the hole card during dealing
                        console.log(`%c[CardViz HOLE_DEBUG] renderCards: HOLE CARD ${card.toString()} mesh not found during Dealing state. Expecting animated path.`, 'color: red;');
                    } else {
                        // console.log(`[CardViz] renderCards: Mesh for dealer card ${card.toString()} not found. State is Dealing. Expecting animated path.`);
                    }
                }
            } else {
                const { position, rotationQuaternion, scaling } = this.calculateCardTransform(
                    card, indexInHand, false, dummyDealerHandInfo, 0, dealerHandFromGame.length
                );
                let needsChange = !cardMesh.position.equalsWithEpsilon(position, 0.01) ||
                    !(cardMesh.rotationQuaternion && cardMesh.rotationQuaternion.equalsWithEpsilon(rotationQuaternion, CardVisualizer.QUATERNION_EPSILON)) ||
                    !cardMesh.scaling.equalsWithEpsilon(scaling, 0.01);
                if (!cardMesh.rotationQuaternion && rotationQuaternion) needsChange = true;

                if (needsChange) { // Dealer cards usually update instantly from renderCards unless it's a flip
                    cardMesh.position = position;
                    if (!cardMesh.rotationQuaternion) cardMesh.rotationQuaternion = Quaternion.Identity();
                    cardMesh.rotationQuaternion.copyFrom(rotationQuaternion);
                    cardMesh.scaling = scaling;
                }
                this.removeVisualTreatmentOverlay(cardMesh);
            }
        });


        Promise.all([...creationPromises, ...animationPromises]).then(() => {
            // If the game is currently in the Dealing state and not restoring, skip cleanup.
            // Meshes are actively being created and animated in.
            // A renderCards call during Dealing (e.g., from an onHandModified event)
            // should not prematurely clean up meshes that are part of the ongoing deal sequence.
            if (currentGameState === GameState.Dealing && !isRestoring) {
                // console.log(`%c[CardViz] renderCards cleanup SKIPPED. State: Dealing, Not Restoring.`, 'color: #4682B4; font-style: italic;');
                // If restoring, and we skipped cleanup due to Dealing state (which shouldn't happen if logic is right),
                // we might still need to signal completion if this was the only path.
                // However, the primary path for restore completion is if creationPromises were run.
                // This specific early exit is for non-restoring "Dealing" state.
                if (isRestoring && this.onAnimationCompleteCallback) { // This condition is unlikely to be met if currentGameState is Dealing
                     setTimeout(() => {
                        if (!this.isAnimationInProgress() && this.onAnimationCompleteCallback) {
                            this.onAnimationCompleteCallback!();
                        }
                    }, 10);
                }
                return; // Exit the .then() callback early, preventing cleanup
            }

            this.cardMeshes.forEach((mesh, id) => {
                if (!allVisibleCardIds.has(id)) {
                    const isDisposingHoleCard = dealerHandFromGame.length > 0 && dealerHandFromGame[0].getUniqueId() === id;
                    if (isDisposingHoleCard) {
                        console.error(`%c[CardViz HOLE_DEBUG] renderCards: DISPOSING MESH FOR HOLE CARD! ID: ${id}`, 'color: red; font-weight: bold; text-decoration: underline;');
                    }
                    // console.log(`%c[CardViz]   -> Disposing mesh for removed card: ${id}`, 'color: #4682B4');
                    this.disposeCardMesh(id);
                }
            });
            // console.log(`%c[CardViz] renderCards finished processing.`, 'color: #4682B4');
            if (isRestoring && this.onAnimationCompleteCallback) {
                setTimeout(() => {
                    if (!this.isAnimationInProgress() && this.onAnimationCompleteCallback) {
                        this.onAnimationCompleteCallback!();
                    }
                }, 10);
            }
        }).catch(error => {
            console.error("[CardViz] Error during async mesh creation/animation in renderCards:", error);
        });
    }

    private disposeCardMesh(cardId: string): void {
        const mesh = this.cardMeshes.get(cardId);
        if (mesh) {
            this.scene.stopAnimation(mesh);
            // Dispose overlay if it exists
            const overlay = mesh.getChildMeshes().find(m => m.name === `${mesh.name}_overlay`);
            overlay?.dispose();
            mesh.material?.dispose();
            mesh.dispose();
            this.cardMeshes.delete(cardId);
        }
    }


    private repositionHandCards(isPlayer: boolean, handDisplayIndex: number, newHandSize: number): void {
        const handCards = isPlayer ? this.blackjackGame.getPlayerHands()[handDisplayIndex].cards : this.blackjackGame.getDealerHand();
        const handInfo = isPlayer ? this.blackjackGame.getPlayerHands()[handDisplayIndex] : null; // null for dealer for simplicity
        const targetDesc = isPlayer ? `Player Hand ${handDisplayIndex}` : 'Dealer';
        // console.log(`%c[CardViz] repositionHandCards for ${targetDesc}. New Size: ${newHandSize}`, 'color: #FFA500');

        handCards.forEach((card, indexInHand) => {
            const cardMesh = this.cardMeshes.get(card.getUniqueId());
            // Only reposition existing cards, not the new one being dealt (which is at index hand.length - 1, or newHandSize - 1)
            if (cardMesh && indexInHand < newHandSize - 1) { // -1 because new card is not yet in this loop
                const { position: newPosition, rotationQuaternion: newRotation, scaling: newScaling } = this.calculateCardTransform(
                    card, indexInHand, isPlayer, handInfo!, handDisplayIndex, newHandSize
                );
                // console.log(`%c[CardViz]   -> Repositioning ${card.toString()} (Index ${indexInHand}) to ${newPosition.toString()}`, 'color: #FFA500');

                // Use the new animateMeshToTransform for consistency, but ensure it doesn't call the global callback.
                this.animateMeshToTransform(cardMesh, newPosition, newRotation, newScaling, Constants.REPOSITION_DURATION_MS, false); // isPrimaryAnimation = false

            } else if (!cardMesh && indexInHand < newHandSize - 1) {
                // console.warn(`[CardViz] Cannot reposition existing card ${card.toString()}, mesh not found in map during repositioning.`);
            }
        });
    }

    /**
     * Calculates the target position, rotation, and scale for a card.
     * @param card The card object.
     * @param indexInHand Index of the card within its specific hand.
     * @param isPlayer True if it's a player's card, false for dealer.
     * @param handInfo The PlayerHandInfo object (null for dealer).
     * @param handDisplayIndex The display index of the hand (0 for dealer, 0 to N for player).
     * @param handSize Total number of cards in this specific hand.
     * @returns Target position, rotation quaternion, and scaling vector.
     */
    private calculateCardTransform(
        card: Card,
        indexInHand: number,
        isPlayer: boolean,
        handInfo: PlayerHandInfo, // Can be null for dealer
        handDisplayIndex: number,
        handSize: number
    ): { position: Vector3, rotationQuaternion: Quaternion, scaling: Vector3 } {
        let xPos: number, yPos: number, zPos: number;
        let currentScaling = Vector3.One(); // Default to normal scale
        const activePlayerHandIndex = this.blackjackGame.getActivePlayerHandIndex();
        const gameState = this.blackjackGame.getGameState();

        if (isPlayer) {
            const isThisHandActive = handDisplayIndex === activePlayerHandIndex;
            // Show normally if this hand is active, or if game is over (all hands shown normally),
            // or if it's not player's turn (e.g. dealer's turn, all player hands are effectively "waiting" but shown normally).
            const showNormally = isThisHandActive || gameState === GameState.GameOver || (gameState !== GameState.PlayerTurn && gameState !== GameState.Dealing);


            if (showNormally) {
                // Active Player Hand or GameOver or DealerTurn: Position hands normally, potentially spread out
                zPos = Constants.PLAYER_HAND_Z;
                const numPlayerHands = this.blackjackGame.getPlayerHands().length;
                let handGroupCenterX = 0; // Center X for this specific hand's group

                if (numPlayerHands > 1) {
                    // Spread out multiple player hands horizontally
                    // Estimate width of a hand: card width + overlaps for a few cards. Max 4-5 cards visible in stack.
                    const singleHandVisualWidth = Constants.CARD_WIDTH + (Math.min(handSize, 4) * Constants.PLAYER_CARD_STACK_X_OFFSET);
                    const groupSpacing = Constants.CARD_WIDTH * 0.4; // Space between hand groups
                    const totalCombinedWidthOfAllHandGroups = (numPlayerHands * singleHandVisualWidth) + Math.max(0, (numPlayerHands - 1) * groupSpacing);
                    const firstHandGroupTheoreticalCenterX = -totalCombinedWidthOfAllHandGroups / 2 + singleHandVisualWidth / 2;
                    handGroupCenterX = firstHandGroupTheoreticalCenterX + handDisplayIndex * (singleHandVisualWidth + groupSpacing);
                }
                // If numPlayerHands is 1, handGroupCenterX remains 0, centering the single hand.

                const stackXOffset = Constants.PLAYER_CARD_STACK_X_OFFSET;
                const stackYOffset = Constants.PLAYER_CARD_STACK_Y_OFFSET;

                // Calculate the offset from the handGroupCenterX to the center of card 0 of the current hand.
                // This ensures the stack of cards for *this* hand is centered around handGroupCenterX.
                const centerOfStackOffset = ((handSize - 1) * stackXOffset) / 2;

                xPos = handGroupCenterX + centerOfStackOffset - (indexInHand * stackXOffset);
                yPos = Constants.CARD_Y_POS + (indexInHand * stackYOffset);
                // Scaling remains Vector3.One()

            } else { // Waiting (Inactive) Player Hand during PlayerTurn (and Dealing if applicable)
                zPos = Constants.SPLIT_WAITING_HAND_Z;
                currentScaling = new Vector3(Constants.SPLIT_WAITING_HAND_SCALE, Constants.SPLIT_WAITING_HAND_SCALE, Constants.SPLIT_WAITING_HAND_SCALE);

                // Position waiting hands stacked to the bottom right.
                let waitingHandOrder = 0; // Order among the waiting hands (0 for the first waiting hand encountered)
                let nonActiveHandsCounted = 0;
                for(let i=0; i < this.blackjackGame.getPlayerHands().length; i++) {
                    if (i !== activePlayerHandIndex) { // Count only non-active hands
                        if (i === handDisplayIndex) {
                            waitingHandOrder = nonActiveHandsCounted;
                            break;
                        }
                        nonActiveHandsCounted++;
                    }
                }

                const waitingHandGroupBaseX = Constants.SPLIT_WAITING_HAND_X; // Anchor for the rightmost waiting hand
                const waitingHandGroupBaseY = Constants.SPLIT_WAITING_HAND_Y;
                // Width of a scaled card stack + spacing
                const scaledCardWidth = Constants.CARD_WIDTH * Constants.SPLIT_WAITING_HAND_SCALE;
                const groupOffsetIncrement = scaledCardWidth + (Constants.PLAYER_CARD_STACK_X_OFFSET * Constants.SPLIT_WAITING_HAND_SCALE * Math.min(handSize,3)) + 0.15;


                // Base X for the group of waiting hands, then offset by order
                // waitingHandOrder = 0 is the rightmost, so subtract for subsequent ones to move left
                xPos = waitingHandGroupBaseX - (waitingHandOrder * groupOffsetIncrement);

                const stackXOffsetMini = Constants.PLAYER_CARD_STACK_X_OFFSET * Constants.SPLIT_WAITING_HAND_SCALE * 0.8; // Reduced overlap for mini cards
                const stackYOffsetMini = Constants.PLAYER_CARD_STACK_Y_OFFSET * Constants.SPLIT_WAITING_HAND_SCALE * 0.6; // Reduced vertical lift

                const centerOfMiniStackOffset = ((handSize - 1) * stackXOffsetMini) / 2;
                xPos = xPos + centerOfMiniStackOffset - (indexInHand * stackXOffsetMini); // Cards stack leftwards from the hand's center
                yPos = waitingHandGroupBaseY + (indexInHand * stackYOffsetMini);
            }
        } else { // Dealer cards
            zPos = Constants.DEALER_HAND_Z;
            const totalWidth = (handSize - 1) * Constants.CARD_SPACING;
            const startXDealer = -(totalWidth / 2);
            xPos = startXDealer + (indexInHand * Constants.CARD_SPACING);
            yPos = Constants.CARD_Y_POS;
            // Scaling remains Vector3.One()
        }

        const targetQuaternion = card.isFaceUp() ? CardVisualizer.FACE_UP_FLAT_QUAT.clone() : CardVisualizer.FACE_DOWN_FLAT_QUAT.clone();
        return { position: new Vector3(xPos, yPos, zPos), rotationQuaternion: targetQuaternion, scaling: currentScaling };
    }

    /** Applies dimming or busted tint to player hand cards if they are not active or are busted. */
    private applyVisualTreatment(mesh: Mesh, handInfo: PlayerHandInfo, handDisplayIndex: number): void {
        const isActiveHand = handDisplayIndex === this.blackjackGame.getActivePlayerHandIndex();
        const isBusted = handInfo.result === GameResult.DealerWins && ScoreCalculator.calculateHandValue(handInfo.cards) > 21;

        this.removeVisualTreatmentOverlay(mesh); // Remove any existing overlay first

        let overlayMaterial: StandardMaterial | null = null;

        // Apply treatment if the game is in PlayerTurn state and there are multiple hands
        if (this.blackjackGame.getGameState() === GameState.PlayerTurn && this.blackjackGame.getPlayerHands().length > 1) {
            if (!isActiveHand) { // If the hand is not the active one
                if (isBusted && handInfo.isResolved) { // And it's busted and resolved (player can't act on it)
                    overlayMaterial = this.getBustedMaterial();
                } else { // Not active, not busted (just waiting) or busted but not yet resolved from player perspective
                    overlayMaterial = this.getDimmedMaterial();
                }
            }
            // Active hand gets no overlay from here during PlayerTurn.
        } else if (isBusted && handInfo.isResolved && this.blackjackGame.getGameState() !== GameState.GameOver) {
            // If a hand busts (even if it's the only one), and is resolved, show busted overlay until game over
            overlayMaterial = this.getBustedMaterial();
        }


        if (overlayMaterial) {
            let overlayMesh = mesh.getChildMeshes(true, (node) => node.name === `${mesh.name}_overlay`)[0] as Mesh;
            if (!overlayMesh) {
                overlayMesh = MeshBuilder.CreatePlane(`${mesh.name}_overlay`, {
                    width: Constants.CARD_WIDTH,
                    height: Constants.CARD_HEIGHT
                }, this.scene);
                overlayMesh.setParent(mesh);
                overlayMesh.isPickable = false;
            }
            overlayMesh.material = overlayMaterial;
            overlayMesh.position = new Vector3(0, 0, -0.001);
            overlayMesh.rotationQuaternion = Quaternion.Identity();
            overlayMesh.isVisible = true;
        }
    }

    private removeVisualTreatmentOverlay(mesh: Mesh): void {
        const overlayMesh = mesh.getChildMeshes(true, (node) => node.name === `${mesh.name}_overlay`)[0] as Mesh;
        if (overlayMesh) {
            overlayMesh.isVisible = false;
        }
    }


    public updateCardVisual(card: Card, forceImmediate: boolean = false): void {
        const cardId = card.getUniqueId();
        const cardMesh = this.cardMeshes.get(cardId);

        const isHoleCardCandidate = this.blackjackGame.getDealerHand().length > 0 && this.blackjackGame.getDealerHand()[0].getUniqueId() === cardId;
        if (isHoleCardCandidate) {
            console.log(`%c[CardViz HOLE_DEBUG] updateCardVisual for HOLE CARD ${card.toString()} (ID: ${cardId}). Mesh found: ${!!cardMesh}. Logical faceUp=${card.isFaceUp()}`, 'color: red; font-weight: bold;');
        }


        if (!cardMesh) {
            if (isHoleCardCandidate) {
                console.error(`%c[CardViz HOLE_DEBUG] HOLE CARD ${card.toString()} MESH NOT FOUND in updateCardVisual!`, 'color: red; font-weight: bold;');
            }
            return;
        }

        let ownerHandInfo: PlayerHandInfo | null = null;
        let ownerHandDisplayIndex: number = -1;
        let indexInOwnerHand: number = -1;
        let isPlayerCard = false;
        let handSize = 0;

        for (let i = 0; i < this.blackjackGame.getPlayerHands().length; i++) {
            const hand = this.blackjackGame.getPlayerHands()[i];
            const cardIdx = hand.cards.findIndex(c => c.getUniqueId() === cardId);
            if (cardIdx !== -1) {
                ownerHandInfo = hand;
                ownerHandDisplayIndex = i;
                indexInOwnerHand = cardIdx;
                isPlayerCard = true;
                handSize = hand.cards.length;
                break;
            }
        }
        if (!isPlayerCard) {
            const dealerCards = this.blackjackGame.getDealerHand();
            const cardIdx = dealerCards.findIndex(c => c.getUniqueId() === cardId);
            if (cardIdx !== -1) {
                ownerHandInfo = { id: "dealer", cards: dealerCards, bet: 0, result: GameResult.InProgress, isResolved: false, canHit: true, isBlackjack: false, isSplitAces: false}; // Dummy for dealer
                ownerHandDisplayIndex = 0;
                indexInOwnerHand = cardIdx;
                handSize = dealerCards.length;
            } else {
                /* console.warn(`[CardViz] updateCardVisual: Card ${card.toString()} not found in any hand.`); */ return;
            }
        }

        if (!ownerHandInfo) return; // Should not happen if card found

        const { rotationQuaternion: targetQuat } = this.calculateCardTransform(
            card, indexInOwnerHand, isPlayerCard, ownerHandInfo, ownerHandDisplayIndex, handSize
        );

        // console.log(`%c[CardViz] updateCardVisual called for ${card.toString()}. Logical faceUp=${card.isFaceUp()}. Force Immediate=${forceImmediate}`, 'color: #BA55D3');


        if (!cardMesh.rotationQuaternion) {
            // console.log(`%c[CardViz]   -> Initializing rotationQuaternion from Euler rotation ${cardMesh.rotation.toString()}`, 'color: #BA55D3');
            cardMesh.rotationQuaternion = Quaternion.FromEulerVector(cardMesh.rotation);
        }

        const currentQuaternion = cardMesh.rotationQuaternion;
        // console.log(`%c[CardViz]   -> Current Quat: ${currentQuaternion.toString()}`, 'color: #BA55D3');
        // console.log(`%c[CardViz]   -> Target Quat: ${targetQuat.toString()}`, 'color: #BA55D3');

        const needsRotation = !currentQuaternion.equalsWithEpsilon(targetQuat, CardVisualizer.QUATERNION_EPSILON);

        if (needsRotation && !forceImmediate) {
            // console.log(`%c[CardViz]   -> Calling animateFlip to target Quaternion.`, 'color: #BA55D3; font-weight: bold;');
            this.animateFlip(cardMesh, targetQuat.clone());
        } else if (needsRotation && forceImmediate) {
            // console.log(`%c[CardViz]   -> Setting rotationQuaternion directly (forceImmediate).`, 'color: #BA55D3; font-weight: bold;');
            cardMesh.rotationQuaternion = targetQuat.clone();
        } else {
            // console.log(`%c[CardViz]   -> No rotation needed. Visual state matches logical state.`, 'color: #BA55D3');
            if (currentQuaternion && !currentQuaternion.equals(targetQuat)) { // Ensure exact match if no animation
                cardMesh.rotationQuaternion = targetQuat.clone();
            }
        }
        if (isPlayerCard) {
            this.applyVisualTreatment(cardMesh, ownerHandInfo, ownerHandDisplayIndex);
        }
    }


    public clearTable(): void {
        // console.log("[CardViz] Clearing table visuals.");
        this.animationInProgress = false; // Should be managed per animation
        this.cardMeshes.forEach((mesh, cardId) => {
            this.disposeCardMesh(cardId);
        });
        this.cardMeshes.clear();

        // Clear material and texture caches
        this.svgTextureCache.clear();
        this.cardFaceMaterials.clear();

        // Dispose and nullify shared materials so they are recreated
        if (this.cardBackMaterial) {
            this.cardBackMaterial.dispose();
            this.cardBackMaterial = null;
        }
        if (this.cardSideMaterial) {
            this.cardSideMaterial.dispose();
            this.cardSideMaterial = null;
        }
        if (this.dimmedMaterial) {
            this.dimmedMaterial.dispose();
            this.dimmedMaterial = null;
        }
        if (this.bustedMaterial) {
            this.bustedMaterial.dispose();
            this.bustedMaterial = null;
        }
        console.log("[CardViz] Cleared table visuals and caches.");
    }


    public isAnimationInProgress(): boolean {
        if (this.animationInProgress) return true; // Global flag for major sequences

        // Check if any card mesh has active animations (more granular)
        for (const mesh of this.cardMeshes.values()) {
            if (this.scene.getAllAnimatablesByTarget(mesh).length > 0) {
                return true;
            }
        }
        return false;
    }


    private animateCardDealing(mesh: Mesh, indexInHand: number, isPlayer: boolean, handDisplayIndex: number, faceUp: boolean, card: Card): void {
        const cardId = card.getUniqueId();
        const targetOwnerDesc = isPlayer ? `Player Hand ${handDisplayIndex}` : 'Dealer';

        const handInfo = isPlayer ? this.blackjackGame.getPlayerHands()[handDisplayIndex] : { id: "dealer", cards: this.blackjackGame.getDealerHand(), bet: 0, result: GameResult.InProgress, isResolved: false, canHit: true, isBlackjack: false, isSplitAces: false};
        const finalHandSize = handInfo.cards.length;

        const { position: targetPos, rotationQuaternion: targetQuat, scaling: targetScaling } = this.calculateCardTransform(
            card, indexInHand, isPlayer, handInfo, handDisplayIndex, finalHandSize
        );

        this.animationInProgress = true;
        const slideFrames = Constants.DEAL_SLIDE_DURATION_MS / 1000 * Constants.FPS;
        const rotationFrames = Constants.DEAL_ROTATION_DURATION_MS / 1000 * Constants.FPS;

        const slideEase = new CubicEase(); slideEase.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
        const rotationEase = new QuadraticEase(); rotationEase.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

        const startQuat = mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : Quaternion.Identity();
        if (!mesh.rotationQuaternion) mesh.rotationQuaternion = startQuat.clone();
        const startScaling = mesh.scaling ? mesh.scaling.clone() : Vector3.One();

        this.repositionHandCards(isPlayer, handDisplayIndex, finalHandSize);

        const posAnim = new Animation("dealPosAnim", "position", Constants.FPS, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
        posAnim.setKeys([{ frame: 0, value: mesh.position.clone() }, { frame: slideFrames, value: targetPos }]);
        posAnim.setEasingFunction(slideEase);

        const rotQuatAnim = new Animation("dealRotQuatAnim", "rotationQuaternion", Constants.FPS, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CONSTANT);
        rotQuatAnim.setKeys([{ frame: 0, value: startQuat }, { frame: rotationFrames, value: targetQuat.clone() }]);
        rotQuatAnim.setEasingFunction(rotationEase);

        const scaleAnim = new Animation("dealScaleAnim", "scaling", Constants.FPS, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
        scaleAnim.setKeys([{ frame: 0, value: startScaling }, { frame: rotationFrames, value: targetScaling }]);
        scaleAnim.setEasingFunction(rotationEase);

        const overallFrames = Math.max(slideFrames, rotationFrames);

        this.scene.beginDirectAnimation(mesh, [posAnim, rotQuatAnim, scaleAnim], 0, overallFrames, false, 1,
            () => {
                mesh.position = targetPos;
                mesh.rotationQuaternion = targetQuat.clone();
                mesh.scaling = targetScaling.clone();
                if (isPlayer) this.applyVisualTreatment(mesh, handInfo, handDisplayIndex);

                const logicalCardData = isPlayer
                    ? this.blackjackGame.getPlayerHands()[handDisplayIndex]?.cards[indexInHand]
                    : this.blackjackGame.getDealerHand()[indexInHand];

                if (logicalCardData && mesh.rotationQuaternion) {
                    const expectedQuatAfterAnim = logicalCardData.isFaceUp() ? CardVisualizer.FACE_UP_FLAT_QUAT.clone() : CardVisualizer.FACE_DOWN_FLAT_QUAT.clone();
                    if (!mesh.rotationQuaternion.equalsWithEpsilon(expectedQuatAfterAnim, CardVisualizer.QUATERNION_EPSILON)) {
                        mesh.rotationQuaternion = expectedQuatAfterAnim.clone();
                    }
                }

                this.animationInProgress = false;

                if (this.onAnimationCompleteCallback) {
                    // console.log(`%c[CardViz] Deal Animation for ${card.toString()} finished. Calling master onAnimationCompleteCallback.`, 'color: #1E90FF');
                    this.onAnimationCompleteCallback();
                } else {
                    // console.warn("[CardViz] Deal animation finished, but no onAnimationCompleteCallback set.");
                }
            }
        );
    }

    private animateFlip(mesh: Mesh, targetQuat: Quaternion): void {
        this.animationInProgress = true;
        const durationFrames = Constants.FLIP_DURATION_MS / 1000 * Constants.FPS;
        const easing = new QuadraticEase(); easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

        const startQuat = mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : CardVisualizer.FACE_UP_FLAT_QUAT.clone();
        if (!mesh.rotationQuaternion) mesh.rotationQuaternion = startQuat.clone();

        const rotQuatAnim = new Animation("flipRotQuatAnim", "rotationQuaternion", Constants.FPS, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CONSTANT);
        rotQuatAnim.setKeys([{ frame: 0, value: startQuat }, { frame: durationFrames, value: targetQuat.clone() }]);
        rotQuatAnim.setEasingFunction(easing);

        this.scene.beginDirectAnimation(mesh, [rotQuatAnim], 0, durationFrames, false, 1, () => {
            mesh.rotationQuaternion = targetQuat.clone();
            this.animationInProgress = false;

            if (this.onAnimationCompleteCallback) {
                // console.log(`%c[CardViz] Flip Animation for ${mesh.name} finished. Calling master onAnimationCompleteCallback.`, 'color: orange');
                this.onAnimationCompleteCallback();
            } else {
                // console.warn("[CardViz] Flip animation finished, but no onAnimationCompleteCallback set.");
            }
        });
    }

    private animateMeshToTransform(mesh: Mesh, targetPos: Vector3, targetQuat: Quaternion, targetScaling: Vector3, durationMs: number, isPrimaryAnimation: boolean): Promise<void> {
        return new Promise<void>((resolve) => {
            if (isPrimaryAnimation) {
                this.animationInProgress = true;
            }

            const anims: Animation[] = [];
            const frameRate = Constants.FPS;
            const totalFrames = durationMs / 1000 * frameRate;
            const ease = new QuadraticEase();
            ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

            if (!mesh.position.equalsWithEpsilon(targetPos)) {
                const posAnim = new Animation(`${mesh.id}_pos_trans`, "position", frameRate, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
                posAnim.setKeys([{ frame: 0, value: mesh.position.clone() }, { frame: totalFrames, value: targetPos }]);
                posAnim.setEasingFunction(ease);
                anims.push(posAnim);
            }

            const currentQuat = mesh.rotationQuaternion || Quaternion.Identity();
            if (!currentQuat.equalsWithEpsilon(targetQuat, CardVisualizer.QUATERNION_EPSILON)) {
                const rotAnim = new Animation(`${mesh.id}_rot_trans`, "rotationQuaternion", frameRate, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CONSTANT);
                rotAnim.setKeys([{ frame: 0, value: currentQuat.clone() }, { frame: totalFrames, value: targetQuat.clone() }]);
                rotAnim.setEasingFunction(ease);
                anims.push(rotAnim);
            }

            if (!mesh.scaling.equalsWithEpsilon(targetScaling)) {
                const scaleAnim = new Animation(`${mesh.id}_scale_trans`, "scaling", frameRate, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
                scaleAnim.setKeys([{ frame: 0, value: mesh.scaling.clone() }, { frame: totalFrames, value: targetScaling }]);
                scaleAnim.setEasingFunction(ease);
                anims.push(scaleAnim);
            }

            if (anims.length > 0) {
                this.scene.beginDirectAnimation(mesh, anims, 0, totalFrames, false, 1.0, () => {
                    mesh.position.copyFrom(targetPos);
                    if(mesh.rotationQuaternion) mesh.rotationQuaternion.copyFrom(targetQuat); else mesh.rotationQuaternion = targetQuat.clone();
                    mesh.scaling.copyFrom(targetScaling);

                    if (isPrimaryAnimation) {
                        this.animationInProgress = false;
                        if(this.onAnimationCompleteCallback) {
                            // console.log(`%c[CardViz] animateMeshToTransform (Primary) for ${mesh.id} finished. Calling master onAnimationCompleteCallback.`, 'color: purple');
                            this.onAnimationCompleteCallback();
                        }
                    }
                    resolve();
                });
            } else {
                if (isPrimaryAnimation) {
                    this.animationInProgress = false;
                    if(this.onAnimationCompleteCallback) {
                        setTimeout(() => { // Ensure it's async if no actual animation ran
                            if (!this.isAnimationInProgress() && this.onAnimationCompleteCallback) {
                                this.onAnimationCompleteCallback();
                            }
                        }, 0);
                    }
                }
                resolve();
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
            // console.log("[CardViz] Creating DYNAMIC card back material...");
            const textureSize = { width: 256, height: 358 }; // Fixed size for back texture for now
            const cornerRadius = 20;

            const texture = new DynamicTexture("dynamicCardBackTexture", textureSize, this.scene, true);
            texture.hasAlpha = true;

            const ctx = texture.getContext();
            const width = textureSize.width;
            const height = textureSize.height;

            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = "#B22222"; // Firebrick red
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

            // Simple cross-hatch pattern
            const patternLineColor = "rgba(0, 0, 0, 0.15)"; // Darker, semi-transparent
            const patternLineWidth = 1; // Thinner lines
            const patternSpacing = 8; // Spacing of lines

            ctx.strokeStyle = patternLineColor;
            ctx.lineWidth = patternLineWidth;

            ctx.save();
            ctx.clip();

            for (let i = -height; i < width; i += patternSpacing) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i + height, height);
                ctx.stroke();
            }
            for (let i = 0; i < width + height; i += patternSpacing) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i - height, height);
                ctx.stroke();
            }
            ctx.restore();

            (ctx as any).imageSmoothingEnabled = true;
            texture.update(false);

            material.diffuseTexture = texture;
            material.useAlphaFromDiffuseTexture = true;
            material.transparencyMode = Material.MATERIAL_ALPHABLEND;

            this.cardBackMaterial = material;

        } catch (error) {
            console.error("[CardViz] CRITICAL error during dynamic back material creation:", error);
            material.diffuseColor = new Color3(1.0, 0.6, 0.6);
        }
        return material;
    }
}
