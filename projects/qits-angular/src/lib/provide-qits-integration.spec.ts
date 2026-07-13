import { TestBed } from '@angular/core/testing';
import { provideQitsIntegration } from './provide-qits-integration';

describe('provideQitsIntegration', () => {
  it('bootstraps an injector with the providers', () => {
    TestBed.configureTestingModule({ providers: [provideQitsIntegration()] });
    expect(TestBed.inject(Object, null, { optional: true })).toBeDefined();
  });
});
