// scenes/components/CardVisualizer.ts
import { Scene, Vector3, MeshBuilder, StandardMaterial, Color3,
    Mesh, Animation, DynamicTexture, EasingFunction, CubicEase } from "@babylonjs/core";
import { Card, Suit, Rank } from "../../game/Card";
import { BlackjackGame } from "../../game/BlackjackGame";
import { GameState } from "../../game/GameState";

export class CardVisualizer {
    //#region Properties
    private scene: Scene;
    private blackjackGame: BlackjackGame;
    private cardMeshes: Map<Card, Mesh> = new Map();
    private deckPosition: Vector3;
    private animationInProgress: boolean = false;
    private onAnimationComplete: () => void;
    //#endregion

    //#region Constructor
    /**
     * Initializes a new instance of the CardVisualizer class.
     * 
     * @param {Scene} scene - The Babylon.js scene where the card visualizations will be rendered.
     * @param {BlackjackGame} blackjackGame - The game logic instance to interact with and visualize card changes.
     * @param {Vector3} deckPosition - The starting position of the card deck in the scene.
     * @param {() => void} onAnimationComplete - Callback function to be called when a card animation completes.
     * 
     * This constructor sets up the card visualizer, linking it to the game logic and 
     * registering necessary callbacks to update card visuals when their state changes.
     */
    constructor(scene: Scene, blackjackGame: BlackjackGame, deckPosition: Vector3, onAnimationComplete: () => void) {
        this.scene = scene;
        this.blackjackGame = blackjackGame;
        this.deckPosition = deckPosition;
        this.onAnimationComplete = onAnimationComplete;
        
        // Register callback for card flips
        this.blackjackGame.addCardFlipCallback((card) => {
            this.updateCardVisual(card);
        });
    }
    //#endregion

    //#region Public Methods
    /**
     * Creates a visual mesh representation of a card and animates it from the deck to its final position.
     *
     * @param {Card} card - The card object containing suit, rank, and face-up status.
     * @param {number} index - The index of the card in the player's or dealer's hand.
     * @param {boolean} isPlayer - Determines if the card belongs to the player's hand.
     * @returns {Mesh} The mesh representing the card in the scene.
     *
     * This function creates a plane mesh for the card, positions it at the deck, calculates 
     * its final position based on the hand it belongs to, sets the card facing up, and assigns
     * a material to it. The card is then animated from the deck to the calculated position.
     */
    public createCardMesh(card: Card, index: number, isPlayer: boolean): Mesh {
        console.log(`Creating card mesh for ${card.toString()}, face up: ${card.isFaceUp()}`);
        
        // Create a plane for the card
        const cardMesh = MeshBuilder.CreatePlane(
            `card_${card.getSuit()}_${card.getRank()}`, 
            { width: 1, height: 1.4 }, 
            this.scene
        );
        
        // Initially position card at the deck
        cardMesh.position = this.deckPosition.clone();
        
        // Calculate final position - improved centering logic
        const finalPosition = this.calculateCardPosition(index, isPlayer);
        
        // Set rotation to face up
        cardMesh.rotation.x = Math.PI/2;
        
        // Create material
        const cardMaterial = this.createCardMaterial(card);
        cardMesh.material = cardMaterial;
        
        // Add animation to move card from deck to position
        this.animateCardDealing(cardMesh, finalPosition, 500);
        
        return cardMesh;
    }

    /**
     * Renders the cards in the player's and dealer's hands by creating or updating
     * the visual representation of each card. This function is called when the game
     * state changes and cards need to be rendered or updated.
     */
    public renderCards(): void {
        console.log("Rendering cards...");
        
        // Get hands
        const playerHand = this.blackjackGame.getPlayerHand();
        const dealerHand = this.blackjackGame.getDealerHand();
        
        console.log(`Player hand has ${playerHand.length} cards`);
        console.log(`Dealer hand has ${dealerHand.length} cards`);
        
        // Handle empty hands (should only happen in Initial state)
        if (playerHand.length === 0 && dealerHand.length === 0) {
            console.log("No cards to render");
            return;
        }
        
        // Clear existing cards if we're starting a new game
        // This prevents duplicate cards from appearing
        if (this.blackjackGame.getGameState() === GameState.PlayerTurn && 
            playerHand.length === 2 && dealerHand.length === 2 && 
            this.cardMeshes.size > 0) {
            console.log("Starting new game, clearing existing cards");
            this.clearTable();
        }
        
        // Track if we created any new cards
        let createdNewCards = false;
        
        // Create dealer card meshes for any cards not already rendered
        dealerHand.forEach((card, index) => {
            if (!this.cardMeshes.has(card)) {
                const mesh = this.createCardMesh(card, index, false);
                this.cardMeshes.set(card, mesh);
                console.log(`Created dealer card mesh for ${card.toString()}`);
                createdNewCards = true;
            }
        });
        
        // Create player card meshes for any cards not already rendered
        playerHand.forEach((card, index) => {
            if (!this.cardMeshes.has(card)) {
                const mesh = this.createCardMesh(card, index, true);
                this.cardMeshes.set(card, mesh);
                console.log(`Created player card mesh for ${card.toString()}`);
                createdNewCards = true;
            }
        });
        
        // If we didn't create any new cards but hand sizes changed,
        // reposition existing cards to ensure proper layout
        if (!createdNewCards) {
            // Reposition dealer and player cards to ensure they're centered
            this.repositionCards(false); // Dealer cards
            this.repositionCards(true);  // Player cards
        }
        
        console.log(`Rendered ${this.cardMeshes.size} cards in total`);
    }

    /**
     * Repositions the cards in a hand (player or dealer) to accommodate any changes to the hand size.
     * The cards are repositioned using a smooth animation with a cubic ease out function.
     * The animation duration is 15 frames, which is approximately 500 ms at 30 fps.
     * The cards are positioned such that they are centered horizontally and spaced evenly apart.
     * The z position is set such that player cards are at z=3 and dealer cards are at z=-3.
     * The y position is set to 0.3 to raise the cards slightly above the table.
     * 
     * @param {boolean} isPlayer - true if the hand belongs to the player, false if it belongs to the dealer.
     */
    public repositionCards(isPlayer: boolean): void {
        const hand = isPlayer ? this.blackjackGame.getPlayerHand() : this.blackjackGame.getDealerHand();
        
        hand.forEach((card, index) => {
            const cardMesh = this.cardMeshes.get(card);
            if (cardMesh) {
                const newPosition = this.calculateCardPosition(index, isPlayer);
                
                // Create animation for repositioning
                const positionAnimation = new Animation(
                    "repositionAnimation",
                    "position",
                    30,
                    Animation.ANIMATIONTYPE_VECTOR3,
                    Animation.ANIMATIONLOOPMODE_CONSTANT
                );
                
                // Add easing
                const easingFunction = new CubicEase();
                easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
                positionAnimation.setEasingFunction(easingFunction);
                
                // Animation keyframes - start from current position
                const keyFrames = [
                    { frame: 0, value: cardMesh.position.clone() },
                    { frame: 15, value: newPosition }
                ];
                positionAnimation.setKeys(keyFrames);
                
                // Attach and run animation
                cardMesh.animations = [positionAnimation];
                this.scene.beginAnimation(cardMesh, 0, 15, false);
            }
        });
    }

    /**
     * Updates the visual representation of a card when its face is flipped.
     * Given a card object, this function gets the mesh associated with it and
     * updates the mesh's material to reflect the new face of the card.
     * 
     * @param {Card} card - The card object to update the visual representation of.
     */
    public updateCardVisual(card: Card): void {
        // Get the mesh associated with this card
        const cardMesh = this.cardMeshes.get(card);
        if (cardMesh) {
            // Update the material to show the card's new face
            cardMesh.material = this.createCardMaterial(card);
        }
    }

    /**
     * Clears the table by disposing of all card visualizations.
     * This method is called when the user starts a new game or leaves the table.
     * It disposes of all the meshes associated with the cards in the player's and dealer's hand
     * and clears the map of card meshes.
     */
    public clearTable(): void {
        console.log("Clearing table");
        // Dispose all card meshes
        this.cardMeshes.forEach(mesh => mesh.dispose());
        this.cardMeshes.clear();
    }

    /**
     * Retrieves whether or not an animation is currently in progress.
     * 
     * @returns {boolean} true if an animation is in progress, false otherwise.
     */
    public isAnimationInProgress(): boolean {
        return this.animationInProgress;
    }
    //#endregion

    //#region Private Methods
    /**
     * Calculates the position of a card in 3D space based on its index in the hand and whether it belongs to the player or dealer.
     * The position is calculated such that the cards are centered horizontally and spaced evenly apart.
     * The z position is set such that player cards are at z=3 and dealer cards are at z=-3.
     * The y position is set to 0.3 to raise the cards slightly above the table.
     * 
     * @param {number} index - The index of the card in the hand.
     * @param {boolean} isPlayer - true if the card belongs to the player, false if it belongs to the dealer.
     * @returns {Vector3} The calculated position of the card.
     */
    private calculateCardPosition(index: number, isPlayer: boolean): Vector3 {
        // Z position: player cards at z=3, dealer cards at z=-3
        const zPos = isPlayer ? 3 : -3;
        
        // Get the hand
        const hand = isPlayer ? this.blackjackGame.getPlayerHand() : this.blackjackGame.getDealerHand();
        const handSize = hand.length;
        
        // Calculate spacing and centering
        const cardWidth = 1.1; // Card width plus small gap
        const totalWidth = handSize * cardWidth;
        const startX = -(totalWidth / 2) + (cardWidth / 2);
        const xPos = startX + (index * cardWidth);
        
        return new Vector3(xPos, 0.3, zPos);
    }

    /**
     * Animates the movement of a card mesh from the deck to the target position over a given duration.
     * The animation is created with a cubic ease out function for a smooth animation.
     * When the animation completes, the onAnimationComplete callback function is called.
     * 
     * @param {Mesh} cardMesh - The mesh representing the card.
     * @param {Vector3} targetPosition - The final position of the card.
     * @param {number} duration - The duration of the animation in milliseconds.
     */
    private animateCardDealing(cardMesh: Mesh, targetPosition: Vector3, duration: number): void {
        this.animationInProgress = true;
        
        // Create position animation
        const positionAnimation = new Animation(
            "positionAnimation",
            "position",
            30, // frames per second
            Animation.ANIMATIONTYPE_VECTOR3,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        
        // Add easing for smooth animation
        const easingFunction = new CubicEase();
        easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
        positionAnimation.setEasingFunction(easingFunction);
        
        // Animation keyframes
        const keyFrames = [
            { frame: 0, value: cardMesh.position.clone() },
            { frame: duration / 1000 * 30, value: targetPosition }
        ];
        positionAnimation.setKeys(keyFrames);
        
        // Attach animation to the mesh
        cardMesh.animations = [positionAnimation];
        
        // Run the animation
        this.scene.beginAnimation(cardMesh, 0, duration / 1000 * 30, false, 1, () => {
            this.animationInProgress = false;
            if (this.onAnimationComplete) {
                this.onAnimationComplete();
            }
        });
    }

    //#region Card Material Setup
    /**
     * Creates a material for a card in the scene based on the given Card instance.
     * The material is created based on the card's suit and rank, and whether the card is face up or down.
     * If the card is face up, the material displays the rank and suit of the card; if the card is face down, it displays the card back pattern.
     * The material is also slightly emissive to make the card less affected by lighting.
     * 
     * @param {Card} card - The card that the material is being created for.
     * @returns {StandardMaterial} The material created for the card.
     */
    public createCardMaterial(card: Card): StandardMaterial {
        // Create dynamic texture for the card
        const texture = new DynamicTexture(
            `texture_${card.getSuit()}_${card.getRank()}`,
            { width: 256, height: 356 },
            this.scene,
            false
        );
        const ctx = texture.getContext() as CanvasRenderingContext2D;
        
        // Fill background white or red based on face up/down
        if (card.isFaceUp()) {
            ctx.fillStyle = "#FFFFFF";
        } else {
            // Match the deck color - using the same dark red as the deck
            ctx.fillStyle = "#880000";
        }
        ctx.fillRect(0, 0, 256, 356);
        
        // Add border
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 8;
        ctx.strokeRect(10, 10, 236, 336);
        
        if (card.isFaceUp()) {
            // Card text
            ctx.fillStyle = (card.getSuit() === Suit.Hearts || card.getSuit() === Suit.Diamonds) ? 
                        "#FF0000" : "#000000";
            ctx.font = "bold 50px Arial";
            ctx.textAlign = "center";
            
            // Draw rank and suit
            const suitSymbols = {
                [Suit.Hearts]: "♥",
                [Suit.Diamonds]: "♦",
                [Suit.Clubs]: "♣",
                [Suit.Spades]: "♠"
            };
            
            ctx.fillText(`${card.getRank()} ${suitSymbols[card.getSuit()]}`, 128, 100);
            ctx.fillText(suitSymbols[card.getSuit()], 128, 200);
        } else {
            // Draw card back pattern - matching the deck color
            ctx.fillStyle = "#880000";
            ctx.fillRect(30, 30, 196, 296);
            
            // Draw some pattern
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 2;
            for (let i = 0; i < 7; i++) {
                for (let j = 0; j < 10; j++) {
                    if ((i + j) % 2 === 0) {
                        ctx.strokeRect(40 + i * 25, 40 + j * 25, 20, 20);
                    }
                }
            }
        }
        
        texture.update();
        
        // Create material
        const cardMaterial = new StandardMaterial(`material_${card.getSuit()}_${card.getRank()}`, this.scene);
        cardMaterial.diffuseTexture = texture;
        cardMaterial.specularColor = new Color3(0, 0, 0);
        
        // Make card slightly emissive so it's not affected by lighting
        cardMaterial.emissiveColor = new Color3(0.5, 0.5, 0.5);
        
        return cardMaterial;
    }
    //#endregion
}
