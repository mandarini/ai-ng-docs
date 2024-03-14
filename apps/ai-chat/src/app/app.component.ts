import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { QueryService } from './query.service';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [RouterModule, CommonModule],
  selector: 'ai-ng-docs-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  aiResponse$: Observable<{ message: string }> | undefined;
  loading = false;
  constructor(private queryService: QueryService) {}

  onEnter(msg: string): void {
    if (msg) {
      this.loading = true;
      this.aiResponse$ = this.queryService.sendQuery(msg).pipe((msg) => {
        this.loading = false;
        return msg;
      });
    }
  }
}
