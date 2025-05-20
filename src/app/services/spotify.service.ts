import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class JamendoService {
  private clientId = 'dcb96b78'; // 👈 Replace with your Jamendo Client ID
  private baseUrl = 'https://api.jamendo.com/v3.0/tracks';

  constructor(private http: HttpClient) {}

  searchTracks(query: string): Observable<any> {
    const url = `${this.baseUrl}?client_id=${this.clientId}&format=json&limit=10&namesearch=${encodeURIComponent(query)}`;
    return this.http.get(url);
  }

getTopSongs(): Observable<any> {
  return this.http.get(`https://api.jamendo.com/v3.0/tracks?client_id=${this.clientId}&format=json&limit=10&order=popularity_total`);
}

getSongsByGenre(genre: string): Observable<any> {
  return this.http.get(`https://api.jamendo.com/v3.0/tracks?client_id=${this.clientId}&format=json&limit=10&tags=${genre}`);
}
  
}
