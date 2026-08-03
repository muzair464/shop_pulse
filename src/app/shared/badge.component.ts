import { Component, input } from '@angular/core';

export type BadgeVariant = 'green' | 'blue' | 'yellow' | 'red' | 'gray';

@Component({
  selector: 'app-badge',
  standalone: true,
  template: `
    <span [class]="variantClass()">
      <ng-content />
    </span>
  `,
})
export class BadgeComponent {
  readonly variant = input<BadgeVariant>('gray');

  variantClass(): string {
    const map: Record<BadgeVariant, string> = {
      green:  'badge-green',
      blue:   'badge-blue',
      yellow: 'badge-yellow',
      red:    'badge-red',
      gray:   'badge-gray',
    };
    return map[this.variant()];
  }
}
