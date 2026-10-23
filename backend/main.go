
package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
	_ "github.com/go-sql-driver/mysql"
)

var db *sql.DB

type Menu struct {
	ID       int64   `json:"id"`
	Title    string  `json:"title"`
	ParentID *int64  `json:"parent_id"`
	Children []*Menu `json:"children"`
}

type MenuRequest struct {
	Title    string `json:"title"`
	ParentID *int64 `json:"parent_id"`
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func connectDatabase() error {
	if err := godotenv.Load(); err != nil {
		return fmt.Errorf("gagal membaca file .env: %w", err)
	}

	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	dbName := os.Getenv("DB_NAME")

	if user == "" || host == "" || port == "" || dbName == "" {
		return fmt.Errorf("konfigurasi database belum lengkap")
	}

	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?parseTime=true",
		user, password, host, port, dbName,
	)

	var err error
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("gagal membuka koneksi database: %w", err)
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return fmt.Errorf("gagal terhubung ke MySQL: %w", err)
	}

	return nil
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "success",
		"message": "NeysaTree backend is running!",
	})
}

func databaseHealthHandler(w http.ResponseWriter, r *http.Request) {
	if err := db.Ping(); err != nil {
		writeError(w, http.StatusServiceUnavailable, "Database connection failed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "success",
		"message": "Connected to NeysaTree MySQL database!",
	})
}


func getMenuByIDHandler(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "ID menu tidak valid")
		return
	}

	var menu Menu
	var parentID sql.NullInt64

	err = db.QueryRow(
		"SELECT id, title, parent_id FROM menus WHERE id = ?",
		id,
	).Scan(&menu.ID, &menu.Title, &parentID)

	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "Menu tidak ditemukan")
			return
		}

		writeError(w, http.StatusInternalServerError, "Gagal mengambil data menu")
		return
	}

	if parentID.Valid {
		value := parentID.Int64
		menu.ParentID = &value
	}

	menu.Children = []*Menu{}

	writeJSON(w, http.StatusOK, menu)
}

func getMenusHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(
		"SELECT id, title, parent_id FROM menus ORDER BY id",
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Gagal mengambil data menu")
		return
	}
	defer rows.Close()

	menus := make(map[int64]*Menu)
	var order []*Menu

	for rows.Next() {
		menu := &Menu{}
		var parentID sql.NullInt64

		if err := rows.Scan(&menu.ID, &menu.Title, &parentID); err != nil {
			writeError(w, http.StatusInternalServerError, "Gagal membaca data menu")
			return
		}

		if parentID.Valid {
			id := parentID.Int64
			menu.ParentID = &id
		}

		menu.Children = []*Menu{}
		menus[menu.ID] = menu
		order = append(order, menu)
	}

	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "Gagal membaca data menu")
		return
	}

	var roots []*Menu

	for _, menu := range order {
		if menu.ParentID == nil {
			roots = append(roots, menu)
			continue
		}

		parent, exists := menus[*menu.ParentID]
		if !exists {
			writeError(w, http.StatusInternalServerError, "Parent menu tidak ditemukan")
			return
		}
		parent.Children = append(parent.Children, menu)
	}

	if roots == nil {
		roots = []*Menu{}
	}

	writeJSON(w, http.StatusOK, roots)
}

func decodeMenuRequest(w http.ResponseWriter, r *http.Request) (MenuRequest, bool) {
	var input MenuRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "Body JSON tidak valid")
		return input, false
	}

	input.Title = strings.TrimSpace(input.Title)
	if input.Title == "" {
		writeError(w, http.StatusBadRequest, "Judul menu wajib diisi")
		return input, false
	}

	if len([]rune(input.Title)) > 150 {
		writeError(w, http.StatusBadRequest, "Judul menu maksimal 150 karakter")
		return input, false
	}

	return input, true
}

func parentExists(parentID int64) (bool, error) {
	var exists bool
	err := db.QueryRow(
		"SELECT EXISTS(SELECT 1 FROM menus WHERE id = ?)",
		parentID,
	).Scan(&exists)

	return exists, err
}

func createMenuHandler(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeMenuRequest(w, r)
	if !ok {
		return
	}

	if input.ParentID != nil {
		if *input.ParentID <= 0 {
			writeError(w, http.StatusBadRequest, "parent_id harus berupa ID yang valid")
			return
		}

		exists, err := parentExists(*input.ParentID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Gagal memeriksa parent menu")
			return
		}
		if !exists {
			writeError(w, http.StatusBadRequest, "Parent menu tidak ditemukan")
			return
		}
	}

	result, err := db.Exec(
		"INSERT INTO menus (title, parent_id) VALUES (?, ?)",
		input.Title, input.ParentID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Gagal menambahkan menu")
		return
	}

	id, err := result.LastInsertId()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Menu dibuat, tetapi ID gagal dibaca")
		return
	}

	var parentID *int64
	if input.ParentID != nil {
		value := *input.ParentID
		parentID = &value
	}

	writeJSON(w, http.StatusCreated, Menu{
		ID:       id,
		Title:    input.Title,
		ParentID: parentID,
		Children: []*Menu{},
	})
}

func updateMenuHandler(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "ID menu tidak valid")
		return
	}

	input, ok := decodeMenuRequest(w, r)
	if !ok {
		return
	}

	result, err := db.Exec(
		"UPDATE menus SET title = ? WHERE id = ?",
		input.Title, id,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Gagal mengedit menu")
		return
	}

	affected, err := result.RowsAffected()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Gagal memeriksa hasil edit")
		return
	}
	if affected == 0 {
		var exists bool
		err := db.QueryRow(
			"SELECT EXISTS(SELECT 1 FROM menus WHERE id = ?)", id,
		).Scan(&exists)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Gagal memeriksa menu")
			return
		}
		if !exists {
			writeError(w, http.StatusNotFound, "Menu tidak ditemukan")
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message": "Menu berhasil diperbarui",
		"id":      id,
		"title":   input.Title,
	})
}

func deleteMenuHandler(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "ID menu tidak valid")
		return
	}

	result, err := db.Exec("DELETE FROM menus WHERE id = ?", id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Gagal menghapus menu")
		return
	}

	affected, err := result.RowsAffected()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Gagal memeriksa hasil penghapusan")
		return
	}
	if affected == 0 {
		writeError(w, http.StatusNotFound, "Menu tidak ditemukan")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message": "Menu dan seluruh turunannya berhasil dihapus",
		"id":      id,
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "http://localhost:5173" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	if err := connectDatabase(); err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", healthHandler)
	mux.HandleFunc("GET /api/health/db", databaseHealthHandler)
	mux.HandleFunc("GET /api/menus", getMenusHandler)
	mux.HandleFunc("GET /api/menus/{id}", getMenuByIDHandler)
	mux.HandleFunc("POST /api/menus", createMenuHandler)
	mux.HandleFunc("PUT /api/menus/{id}", updateMenuHandler)
	mux.HandleFunc("DELETE /api/menus/{id}", deleteMenuHandler)

	log.Println("NeysaTree backend running at http://localhost:8080")
	log.Println("Database connection successful!")
	log.Fatal(http.ListenAndServe(":8080", corsMiddleware(mux)))
}
