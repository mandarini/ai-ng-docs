import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class QueryService {
  private apiUrl = 'http://localhost:4200/api';

  constructor(private http: HttpClient) {}

  sendQuery(query: string) {
    return this.http.post<{message: string}>(this.apiUrl, { query });
  }
}
