import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core';

/** Focus host element after view init (use on a single primary input per view). */
@Directive({
  selector: '[appAutofocus]',
  standalone: true,
})
export class AutofocusDirective implements AfterViewInit {
  private readonly el = inject(ElementRef<HTMLElement>);

  ngAfterViewInit(): void {
    queueMicrotask(() => this.el.nativeElement.focus());
  }
}
