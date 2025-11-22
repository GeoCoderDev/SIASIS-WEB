import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { CLN01_Stores } from "./CLN01_Stores";
import { SIASIS_CLN01_VERSION } from "@/constants/SIASIS_CLN01_VERSION";

const nombre_rol_local_storage = "rol";
const nombre_postfix_local_storage = "PostfixIDBFromUserData";

export class IndexedDBConnection {
  private static instance: IndexedDBConnection;
  private db: IDBDatabase | null = null;

  // Static property that initializes intelligently
  private static _rol: RolesSistema | null = null;
  private static _PostfixIDB: string | null = null;

  // We use the environment variable for the version
  private dbVersionString: string = SIASIS_CLN01_VERSION;
  private version: number;
  private isInitializing: boolean = false;
  private initPromise: Promise<IDBDatabase> | null = null;

  private constructor() {
    // Private constructor for Singleton pattern
    this.version = this.getVersionNumber(this.dbVersionString);
  }

  /**
   * Getter for role that auto-initializes from localStorage if necessary
   */
  public static get rol(): RolesSistema {
    // If not set, try to load from localStorage
    if (!IndexedDBConnection._rol) {
      IndexedDBConnection._rol = IndexedDBConnection.loadRolFromStorage();
    }
    return IndexedDBConnection._rol;
  }

  /**
   * Setter for role that also saves it to localStorage
   */
  public static set rol(newRol: RolesSistema) {
    IndexedDBConnection._rol = newRol;
    // Save to localStorage if we're on the client
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(nombre_rol_local_storage, newRol);
    }
  }

  /**
   * Getter for PostfixIDBFromUserData that auto-initializes from localStorage if necessary
   */
  public static get PostfixIDBFromUserData(): string {
    // If not set, try to load from localStorage
    if (!IndexedDBConnection._PostfixIDB) {
      IndexedDBConnection._PostfixIDB =
        IndexedDBConnection.loadPostfixFromStorage();
    }
    return IndexedDBConnection._PostfixIDB;
  }

  /**
   * Setter for PostfixIDBFromUserData
   */
  public static set PostfixIDBFromUserData(username: string) {
    IndexedDBConnection._PostfixIDB = `U${username.substring(0, 3)}`;
    // Save to localStorage if we're on the client
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(
        nombre_postfix_local_storage,
        IndexedDBConnection._PostfixIDB
      );
    }
  }

  /**
   * Safely loads role from localStorage
   */
  private static loadRolFromStorage(): RolesSistema {
    // Check if we're on the client
    if (typeof window !== "undefined" && window.localStorage) {
      const storedRole = localStorage.getItem(
        nombre_rol_local_storage
      ) as RolesSistema;
      if (storedRole && Object.values(RolesSistema).includes(storedRole)) {
        return storedRole;
      }
    }
    // Default value if nothing in localStorage or not valid
    return RolesSistema.Directivo;
  }

  /**
   * Safely loads postfix from localStorage
   */
  private static loadPostfixFromStorage(): string {
    // Check if we're on the client
    if (typeof window !== "undefined" && window.localStorage) {
      if (localStorage.getItem(nombre_postfix_local_storage))
        return localStorage.getItem(nombre_postfix_local_storage)!;
    }
    // Default value if nothing in localStorage or not valid
    return "XXX";
  }

  /**
   * Gets the database name based on the current role
   */
  private get dbName(): string {
    return `SIASIS-CLN01-${IndexedDBConnection.rol}-${IndexedDBConnection.PostfixIDBFromUserData}`;
  }

  /**
   * Forces role reload from localStorage
   * Useful when you know the role changed externally
   */
  public static reloadRolFromStorage(): void {
    IndexedDBConnection._rol = IndexedDBConnection.loadRolFromStorage();
  }

  /**
   * Gets the unique IndexedDB connection instance
   */
  public static getInstance(): IndexedDBConnection {
    if (!IndexedDBConnection.instance) {
      IndexedDBConnection.instance = new IndexedDBConnection();
    }
    return IndexedDBConnection.instance;
  }

  /**
   * Changes role and reinitializes connection to the corresponding DB
   */
  public async changeRole(newRole: RolesSistema): Promise<void> {
    const currentRole = IndexedDBConnection.rol;

    // If same role, do nothing
    if (currentRole === newRole) return;

    // Close current connection
    this.close();

    // Change role (this automatically updates localStorage)
    IndexedDBConnection.rol = newRole;

    // Reinitialize with the new database
    await this.init();
  }

  /**
   * Initializes the database connection
   */
  public async init(): Promise<IDBDatabase> {
    // Verify we're on the client
    if (typeof window === "undefined") {
      throw new Error("IndexedDB solo está disponible en el navegador");
    }

    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.isInitializing = true;
    this.initPromise = new Promise((resolve, reject) => {
      // When opening with a higher version, IndexedDB automatically
      // triggers onupgradeneeded and manages the migration
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        console.log(
          `Actualizando base de datos a versión ${this.version} para rol ${IndexedDBConnection.rol}`
        );
        const db = (event.target as IDBOpenDBRequest).result;

        // If there are existing stores we no longer need, delete them
        for (let i = 0; i < db.objectStoreNames.length; i++) {
          const storeName = db.objectStoreNames[i];
          if (!Object.keys(CLN01_Stores).includes(storeName)) {
            db.deleteObjectStore(storeName);
          }
        }

        this.configureDatabase(db);
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.isInitializing = false;
        console.log(
          `Base de datos inicializada correctamente con versión ${this.version} para rol ${IndexedDBConnection.rol}`
        );
        resolve(this.db);
      };

      request.onerror = (event) => {
        this.isInitializing = false;
        this.initPromise = null;
        reject(
          `Error al abrir IndexedDB: ${
            (event.target as IDBOpenDBRequest).error
          }`
        );
      };
    });

    return this.initPromise;
  }

  /**
   * Configures the database structure
   */
  private configureDatabase(db: IDBDatabase): void {
    // Create object stores and their indexes
    for (const [storeName, config] of Object.entries(CLN01_Stores)) {
      if (!db.objectStoreNames.contains(storeName)) {
        const store = db.createObjectStore(storeName, {
          keyPath: config.keyPath,
          autoIncrement: config.autoIncrement,
        });

        // Create indexes
        for (const index of config.indexes) {
          store.createIndex(index.name, index.keyPath, index.options);
        }
      }
    }
  }

  /**
   * Converts semantic version to an integer for IndexedDB
   */
  private getVersionNumber(versionString: string): number {
    // Remove any suffix (like -alpha, -beta, etc.)
    const cleanVersion = versionString.split("-")[0];

    // Split by dots and convert to an integer
    // For example: "1.2.3" -> 1 * 10000 + 2 * 100 + 3 = 10203
    const parts = cleanVersion.split(".");
    let versionNumber = 1; // Valor por defecto

    if (parts.length >= 3) {
      versionNumber =
        parseInt(parts[0]) * 10000 +
        parseInt(parts[1]) * 100 +
        parseInt(parts[2]);
    }

    return versionNumber;
  }

  /**
   * Gets the database connection
   */
  public async getConnection(): Promise<IDBDatabase> {
    if (!this.db) {
      return this.init();
    }
    return this.db;
  }

  /**
   * Closes the database connection
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }

  /**
   * Gets a transaction for a specific store
   */
  public async getTransaction(
    storeName: string,
    mode: IDBTransactionMode = "readonly"
  ): Promise<IDBTransaction> {
    const db = await this.getConnection();
    return db.transaction(storeName, mode);
  }

  /**
   * Gets an object store to perform operations
   */
  public async getStore(
    storeName: string,
    mode: IDBTransactionMode = "readonly"
  ): Promise<IDBObjectStore> {
    const transaction = await this.getTransaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  /**
   * Executes an operation on the database
   */
  public async executeOperation<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const store = await this.getStore(storeName, mode);

    return new Promise<T>((resolve, reject) => {
      const request = operation(store);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        reject(`Error en operación: ${(event.target as IDBRequest).error}`);
      };
    });
  }

  /**
   * Gets current state information
   */
  public getStatus() {
    return {
      currentRole: IndexedDBConnection.rol,
      dbName: this.dbName,
      isConnected: !!this.db,
      isInitializing: this.isInitializing,
    };
  }
}

// Export the unique instance
export default IndexedDBConnection.getInstance();
