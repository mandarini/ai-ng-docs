import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, map, startWith } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class QueryService {
  private apiUrl = 'http://localhost:4200/api';

  constructor(private http: HttpClient) {}

  sendQuery(query: string): Observable<{
    loading: boolean;
    data?: string;
  }> {
    return this.http.post<{ message: string }>(this.apiUrl, { query }).pipe(
      map((response) => ({ loading: false, data: response.message })),
      startWith({ loading: true }),
      catchError((error) => throwError(() => new Error(error))),
      finalize(() => ({ loading: false }))
    );
  }
}
