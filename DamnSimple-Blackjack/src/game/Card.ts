// src/game/card-ts
/** Defines the suits of a standard playing card. */
export enum Suit {
    Hearts = "Hearts",
    Diamonds = "Diamonds",
    Clubs = "Clubs",
    Spades = "Spades"
}

/** Defines the ranks of a standard playing card. */
export enum Rank {
    Two = "2",
    Three = "3",
    Four = "4",
    Five = "5",
    Six = "6",
    Seven = "7",
    Eight = "8",
    Nine = "9",
    Ten = "10",
    Jack = "J",
    Queen = "Q",
    King = "K",
    Ace = "A"
}

export class Card {
    private suit: Suit;
    private rank: Rank;
    /** Indicates if the card's face is visible. */
    private faceUp: boolean;
    /** A unique identifier for this specific card instance (useful for tracking visuals). */
    private _uniqueId: string;

    /** Callback function triggered when the card's faceUp state changes via flip(). */
    public onFlip: ((card: Card) => void) | null = null;

    constructor(suit: Suit, rank: Rank) {
        this.suit = suit;
        this.rank = rank;
        this.faceUp = false; // Cards are typically created face down initially
        // Generate a unique ID using suit, rank, timestamp, and random number
        this._uniqueId = `${suit}-${rank}-${Date.now()}-${Math.random()}`;
    }

    /** Gets the unique identifier for this card instance. */
    public getUniqueId(): string {
        return this._uniqueId;
    }

    /** Gets the suit of the card. */
    public getSuit(): Suit {
        return this.suit;
    }

    /** Gets the rank of the card. */
    public getRank(): Rank {
        return this.rank;
    }

    /**
     * Gets the numeric rank value used specifically for texture filenames.
     * Ace=1, 2-10, Jack=11, Queen=12, King=13.
     * @returns The numeric rank value for texture mapping.
     */
    public getRankValueForTexture(): number {
        switch (this.rank) {
            case Rank.Ace: return 1;
            case Rank.Jack: return 11;
            case Rank.Queen: return 12;
            case Rank.King: return 13;
            default: return parseInt(this.rank); // Handles "2" through "10"
        }
    }

    /** Checks if the card is currently face up. */
    public isFaceUp(): boolean {
        return this.faceUp;
    }

    /**
     * Directly sets the face-up state of the card without triggering the onFlip callback.
     * Used primarily for initialization or restoring state.
     * @param value The desired face-up state (true for face up, false for face down).
     */
    public setFaceUp(value: boolean): void {
        // No flip notification here, this is for setting initial state
        this.faceUp = value;
    }

    /**
     * Toggles the card's face-up state (face up -> face down, or vice versa)
     * and triggers the onFlip callback if registered.
     */
    public flip(): void {
        const previousState = this.faceUp;
        this.faceUp = !this.faceUp;
        // console.log(`Card ${this.toString()} flipped to ${this.faceUp ? 'up' : 'down'}. Notifying listeners.`); // Reduce log noise
        if (this.onFlip) {
            this.onFlip(this); // Notify listeners about the flip
        } else {
             // console.warn(`Card ${this.toString()} flipped, but no onFlip callback registered.`); // Reduce log noise
        }
    }

    /**
     * Registers a callback function to be called when this card instance is flipped.
     * @param callback The function to call, receiving this Card instance as an argument.
     */
    public setFlipCallback(callback: (card: Card) => void): void {
        this.onFlip = callback;
    }

    /**
     * Gets the Blackjack game value of the card.
     * Ace is 11 (can be adjusted later), face cards are 10, number cards are their number.
     * @returns The numeric value of the card in Blackjack.
     */
    public getValue(): number {
        switch (this.rank) {
            case Rank.Ace: return 11; // Ace is initially 11
            case Rank.Jack:
            case Rank.Queen:
            case Rank.King: return 10; // Face cards are 10
            default:
                // For ranks "2" through "10", parse the string to an integer
                const numericRank = parseInt(this.rank);
                // Return the parsed number, or 0 if parsing fails (shouldn't happen with valid Ranks)
                return isNaN(numericRank) ? 0 : numericRank;
        }
    }

    /** Returns a string representation of the card (e.g., "Ace of Spades"). */
    public toString(): string {
        return `${this.rank} of ${this.suit}`;
    }
}
