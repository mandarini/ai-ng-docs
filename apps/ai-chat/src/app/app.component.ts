import { Component } from '@angular/core';
import { QueryService } from './query.service';
import { Observable } from 'rxjs';
import { RouterModule } from '@angular/router';

import { CommonModule } from '@angular/common';
@Component({
  standalone: true,
  imports: [RouterModule, CommonModule],
  selector: 'ai-ng-docs-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  response$:
    | Observable<{
        loading: boolean;
        data?: string;
      }>
    | undefined;

  constructor(private queryService: QueryService) {}

  onEnter(query: string): void {
    this.response$ = this.queryService.sendQuery(query);
  }
}
